// gpu-chores: two-pass Float32 reduction (sum / min / max).
// Pass 1 reduces each 64-wide block into `partials`; pass 2 folds the
// partials down to `partials[0]`, which is the only value read back.

struct ReduceParams {
    count: u32,   // elements in `data`
    op: u32,      // 0 = sum, 1 = min, 2 = max
    stride: u32,  // partial count for pass 2
    _pad: u32,
};

@group(0) @binding(0) var<storage, read> data: array<f32>;
@group(0) @binding(1) var<storage, read_write> partials: array<f32>;
@group(0) @binding(2) var<uniform> params: ReduceParams;

var<workgroup> scratch: array<f32, 64>;

fn identity(op: u32) -> f32 {
    if (op == 1u) { return 3.4028235e38; }
    if (op == 2u) { return -3.4028235e38; }
    return 0.0;
}

fn combine(op: u32, a: f32, b: f32) -> f32 {
    if (op == 1u) { return min(a, b); }
    if (op == 2u) { return max(a, b); }
    return a + b;
}

@compute @workgroup_size(64)
fn reduce_block(
    @builtin(global_invocation_id) gid: vec3<u32>,
    @builtin(local_invocation_id) lid: vec3<u32>,
    @builtin(workgroup_id) wid: vec3<u32>,
) {
    let op = params.op;
    let i = gid.x;
    var v = identity(op);
    if (i < params.count) {
        v = data[i];
    }
    scratch[lid.x] = v;
    workgroupBarrier();

    var stride = 32u;
    loop {
        if (stride == 0u) { break; }
        if (lid.x < stride) {
            scratch[lid.x] = combine(op, scratch[lid.x], scratch[lid.x + stride]);
        }
        workgroupBarrier();
        stride = stride >> 1u;
    }

    if (lid.x == 0u) {
        partials[wid.x] = scratch[0];
    }
}

// Single workgroup. Folds `params.stride` partials into partials[0].
@compute @workgroup_size(64)
fn reduce_partials(@builtin(local_invocation_id) lid: vec3<u32>) {
    let op = params.op;
    var acc = identity(op);
    var i = lid.x;
    loop {
        if (i >= params.stride) { break; }
        acc = combine(op, acc, partials[i]);
        i = i + 64u;
    }
    scratch[lid.x] = acc;
    workgroupBarrier();

    var stride = 32u;
    loop {
        if (stride == 0u) { break; }
        if (lid.x < stride) {
            scratch[lid.x] = combine(op, scratch[lid.x], scratch[lid.x + stride]);
        }
        workgroupBarrier();
        stride = stride >> 1u;
    }

    if (lid.x == 0u) {
        partials[0] = scratch[0];
    }
}
