// Billboard particle overlay renderer (composites over Filament WebGL2 canvas).

struct Particle {
    pos: vec3<f32>,
    life: f32,
    vel: vec3<f32>,
    maxLife: f32,
    color: vec4<f32>,
    size: f32,
    drag: f32,
    gravityFlag: f32,
    active: f32,
};

struct CameraUniforms {
    viewProj: mat4x4<f32>,
    eye: vec3<f32>,
    pad0: f32,
    viewport: vec2<f32>,
    pad1: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;

const QUAD: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
);

@vertex
fn vs_main(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
    var out: VertexOutput;
    let p = particles[instanceIndex];

    if (p.active < 0.5 || p.life <= 0.0) {
        out.position = vec4<f32>(0.0, 0.0, -2.0, 1.0);
        out.color = vec4<f32>(0.0);
        return out;
    }

    let toCam = normalize(camera.eye - p.pos);
    let upRef = vec3<f32>(0.0, 1.0, 0.0);
    var right = normalize(cross(upRef, toCam));
    if (length(right) < 0.001) {
        right = vec3<f32>(1.0, 0.0, 0.0);
    }
    let up = cross(toCam, right);

    let corner = QUAD[vertexIndex];
    let half = p.size * 0.5;
    let worldPos = p.pos + right * corner.x * half + up * corner.y * half;

    out.position = camera.viewProj * vec4<f32>(worldPos, 1.0);
    let alpha = p.color.a * clamp(p.life / max(p.maxLife, 0.0001), 0.0, 1.0);
    out.color = vec4<f32>(p.color.rgb, alpha);
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    if (in.color.a <= 0.001) {
        discard;
    }
    return in.color;
}
