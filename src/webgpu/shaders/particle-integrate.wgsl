// GPU particle integration — matches CPU ParticleSystem forces (gravity + drag).

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

struct SimParams {
    deltaTime: f32,
    maxParticles: u32,
    gravity: vec3<f32>,
    pad: f32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;
@group(0) @binding(2) var<storage, read_write> activeFlags: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if (i >= params.maxParticles) {
        return;
    }

    var p = particles[i];
    if (p.active < 0.5) {
        activeFlags[i] = 0.0;
        return;
    }

    p.life -= params.deltaTime;
    if (p.life <= 0.0) {
        p.active = 0.0;
        p.life = 0.0;
        particles[i] = p;
        activeFlags[i] = 0.0;
        return;
    }

    if (p.gravityFlag > 0.5) {
        p.vel += params.gravity * params.deltaTime;
    }

    let dragFactor = pow(p.drag, params.deltaTime);
    p.vel *= dragFactor;
    p.pos += p.vel * params.deltaTime;
    particles[i] = p;
    activeFlags[i] = p.active;
}
