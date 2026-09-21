// gpu-chores: distance from one origin to a packed xyz point list.
// `mode` picks squared (0) or euclidean (1) output.

struct DistanceParams {
    count: u32,
    mode: u32,
    _pad0: u32,
    _pad1: u32,
    origin: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> points: array<f32>;
@group(0) @binding(1) var<storage, read_write> distances: array<f32>;
@group(0) @binding(2) var<uniform> params: DistanceParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if (i >= params.count) { return; }
    let b = i * 3u;
    let d = vec3<f32>(points[b], points[b + 1u], points[b + 2u]) - params.origin.xyz;
    let d2 = dot(d, d);
    if (params.mode == 1u) {
        distances[i] = sqrt(d2);
    } else {
        distances[i] = d2;
    }
}
