// gpu-chores: stable stream compaction via block-local prefix sum.
//
// Pass 1 (`block_scan`)   per-64-element exclusive scan of the 0/1 predicate,
//                         writing local offsets plus one block total.
// Pass 2 (`scan_blocks`)  exclusive scan of the block totals (single workgroup).
// Pass 3 (`scatter`)      writes surviving source indices to their slot.
//
// Only `blockSums[0]` (the survivor count) needs to leave the GPU; the index
// list can stay resident when the renderer consumes it directly.

struct CompactParams {
    count: u32,      // elements in `flags`
    blockCount: u32, // ceil(count / 64)
    threshold: f32,
    _pad: u32,
};

@group(0) @binding(0) var<storage, read> flags: array<f32>;
@group(0) @binding(1) var<storage, read_write> localOffsets: array<u32>;
@group(0) @binding(2) var<storage, read_write> blockSums: array<u32>;
@group(0) @binding(3) var<storage, read_write> indices: array<u32>;
@group(0) @binding(4) var<uniform> params: CompactParams;

var<workgroup> scratch: array<u32, 64>;

fn predicate(i: u32) -> u32 {
    if (i >= params.count) { return 0u; }
    if (flags[i] >= params.threshold) { return 1u; }
    return 0u;
}

@compute @workgroup_size(64)
fn block_scan(
    @builtin(global_invocation_id) gid: vec3<u32>,
    @builtin(local_invocation_id) lid: vec3<u32>,
    @builtin(workgroup_id) wid: vec3<u32>,
) {
    let p = predicate(gid.x);
    scratch[lid.x] = p;
    workgroupBarrier();

    // Hillis-Steele inclusive scan over the 64-wide block.
    var offset = 1u;
    loop {
        if (offset >= 64u) { break; }
        var addend = 0u;
        if (lid.x >= offset) {
            addend = scratch[lid.x - offset];
        }
        workgroupBarrier();
        scratch[lid.x] = scratch[lid.x] + addend;
        workgroupBarrier();
        offset = offset << 1u;
    }

    // Inclusive -> exclusive.
    if (gid.x < params.count) {
        localOffsets[gid.x] = scratch[lid.x] - p;
    }
    if (lid.x == 63u) {
        blockSums[wid.x] = scratch[63u];
    }
}

// Single workgroup, single thread: blockCount is ceil(count / 64), so this is
// ~128 iterations for an 8k particle pool — cheaper than a third dispatch.
@compute @workgroup_size(64)
fn scan_blocks(@builtin(local_invocation_id) lid: vec3<u32>) {
    if (lid.x != 0u) { return; }
    var running = 0u;
    var i = 0u;
    loop {
        if (i >= params.blockCount) { break; }
        let total = blockSums[i];
        blockSums[i] = running;
        running = running + total;
        i = i + 1u;
    }
    // Survivor count lands past the block sums; this is the only readback.
    blockSums[params.blockCount] = running;
}

@compute @workgroup_size(64)
fn scatter(
    @builtin(global_invocation_id) gid: vec3<u32>,
    @builtin(workgroup_id) wid: vec3<u32>,
) {
    if (gid.x >= params.count) { return; }
    if (flags[gid.x] < params.threshold) { return; }
    indices[blockSums[wid.x] + localOffsets[gid.x]] = gid.x;
}
