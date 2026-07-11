// ============================================================================
// Breathing Meditation Shader - Base Structure
// ============================================================================
// Uniform buffer matching React BreathUniforms interface
struct BreathUniforms {
    time: f32,
    phase: u32,          // 0=inhale, 1=hold1, 2=exhale, 3=hold2
    phaseProgress: f32,  // 0.0 -> 1.0 within current phase
    cycle: u32,
    strengthLevel: u32,  // 0-10
    intensity: f32,      // 0.0-1.0
}

@binding(0) @group(0) var<uniform> u_breath: BreathUniforms;

// ============================================================================
// Constants
// ============================================================================
const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const EPSILON: f32 = 0.001;

// ============================================================================
// SDF Primitives & Operations
// ============================================================================
fn sdSphere(p: vec3f, r: f32) -> f32 {
    return length(p) - r;
}

fn sdCapsule(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

fn sdPill(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
    // Smooth capsule/pill shape
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

fn sdBox(p: vec3f, b: vec3f) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

fn sminBlend(a: f32, b: f32, k: f32) -> vec2f {
    let h = max(k - abs(a - b), 0.0) / k;
    let m = h * h * 0.5;
    let s = m * k * 0.5;
    return vec2f(min(a, b) - s, m);
}

// ============================================================================
// Transformation Helpers
// ============================================================================
fn rot2(angle: f32) -> mat2x2f {
    let c = cos(angle);
    let s = sin(angle);
    return mat2x2f(c, -s, s, c);
}

fn pModPolar(p: vec2f, repetitions: f32) -> vec2f {
    let angle = TAU / repetitions;
    let a = atan2(p.y, p.x) + angle * 0.5;
    let r = length(p);
    let c = floor(a / angle);
    let new_a = a - c * angle - angle * 0.5;
    return vec2f(cos(new_a), sin(new_a)) * r;
}

fn repeat(p: vec3f, c: vec3f) -> vec3f {
    return p - c * round(p / c);
}

// ============================================================================
// Figure Construction (Humanoid)
// ============================================================================
// Returns vec4: (distance, material_id, uv_x, uv_y)
// Material IDs: 0=body, 1=head, 2=arm, 3=leg, 4=hand

fn map(p: vec3f) -> vec4f {
    var pos = p;
    
    // --- Torso (chest capsule) ---
    let chest_a = vec3f(0.0, 0.0, 0.0);
    let chest_b = vec3f(0.0, 0.5, 0.0);
    let chest_r = 0.25;
    var d = sdPill(pos, chest_a, chest_b, chest_r);
    var mat = 0.0;
    
    // --- Head ---
    let head_pos = vec3f(0.0, 0.85, 0.0);
    let head_r = 0.18;
    let d_head = sdSphere(pos - head_pos, head_r);
    if (d_head < d) {
        d = d_head;
        mat = 1.0;
    }
    
    // --- Arms (simple pills for now - Agent 1 will enhance) ---
    // Left arm
    let l_shoulder = vec3f(-0.3, 0.4, 0.0);
    let l_hand = vec3f(-0.5, -0.3, 0.0);
    let d_larm = sdPill(pos, l_shoulder, l_hand, 0.08);
    // Right arm
    let r_shoulder = vec3f(0.3, 0.4, 0.0);
    let r_hand = vec3f(0.5, -0.3, 0.0);
    let d_rarm = sdPill(pos, r_shoulder, r_hand, 0.08);
    
    let d_arms = min(d_larm, d_rarm);
    if (d_arms < d) {
        d = d_arms;
        mat = 2.0;
    }
    
    // --- Legs ---
    let l_hip = vec3f(-0.15, -0.1, 0.0);
    let l_foot = vec3f(-0.2, -1.0, 0.0);
    let d_lleg = sdPill(pos, l_hip, l_foot, 0.12);
    
    let r_hip = vec3f(0.15, -0.1, 0.0);
    let r_foot = vec3f(0.2, -1.0, 0.0);
    let d_rleg = sdPill(pos, r_hip, r_foot, 0.12);
    
    let d_legs = min(d_lleg, d_rleg);
    if (d_legs < d) {
        d = d_legs;
        mat = 3.0;
    }
    
    // --- Background Sacred Geometry (Agent 3 will enhance) ---
    let bg_pos = pos * 0.5;
    let bg_repeat = repeat(bg_pos, vec3f(2.0));
    let d_bg = sdBox(bg_repeat, vec3f(0.3)) - 0.05;
    d_bg = max(d_bg, -(length(bg_repeat) - 0.4)); // Hollow effect
    
    if (d_bg < d) {
        d = d_bg;
        mat = 5.0;
    }
    
    return vec4f(d, mat, 0.0, 0.0);
}

// ============================================================================
// Chakra Energy Visualization (Agent 2 will enhance)
// ============================================================================
fn chakras(p: vec3f, tt: f32) -> vec3f {
    // 7 Chakra positions along spine
    let offs = array<vec3f, 7>(
        vec3f(0.0, -0.8, 0.0),   // Root (red)
        vec3f(0.0, -0.5, 0.0),   // Sacral (orange)
        vec3f(0.0, -0.2, 0.0),   // Solar Plexus (yellow)
        vec3f(0.0, 0.1, 0.0),    // Heart (green)
        vec3f(0.0, 0.35, 0.0),   // Throat (blue)
        vec3f(0.0, 0.6, 0.0),    // Third Eye (indigo)
        vec3f(0.0, 0.9, 0.0)     // Crown (violet)
    );
    
    let hues = array<f32, 7>(0.0, 0.08, 0.16, 0.33, 0.58, 0.75, 0.83);
    
    var col = vec3f(0.0);
    
    for (var i: i32 = 0; i < 7; i = i + 1) {
        let center = offs[i];
        let dist = length(p - center);
        let anim = 0.1 + 0.9 * sin(-4.0 * tt + TAU * f32(i) / 7.0);
        let radius = 0.08 * anim;
        let glow = smoothstep(radius + 0.15, radius, dist);
        
        let h = hues[i];
        let rgb = vec3f(
            abs(h * 6.0 - 3.0) - 1.0,
            2.0 - abs(h * 6.0 - 2.0),
            2.0 - abs(h * 6.0 - 4.0)
        );
        let chakra_col = clamp(rgb, vec3f(0.0), vec3f(1.0));
        
        col += chakra_col * glow * 0.5;
    }
    
    return col;
}

// ============================================================================
// Sacred Geometry Rings (Agent 3 will enhance)
// ============================================================================
fn hexRing(p: vec2f, r: f32, thickness: f32) -> f32 {
    let angle = TAU / 6.0;
    let a = atan2(p.y, p.x);
    let sector = round(a / angle);
    let a0 = sector * angle;
    let p_rot = vec2f(
        p.x * cos(-a0) - p.y * sin(-a0),
        p.x * sin(-a0) + p.y * cos(-a0)
    );
    return abs(length(p_rot) - r) - thickness;
}

fn triRing(p: vec2f, r: f32, thickness: f32) -> f32 {
    let angle = TAU / 3.0;
    let a = atan2(p.y, p.x);
    let sector = round(a / angle);
    let a0 = sector * angle;
    let p_rot = vec2f(
        p.x * cos(-a0) - p.y * sin(-a0),
        p.x * sin(-a0) + p.y * cos(-a0)
    );
    return abs(length(p_rot) - r) - thickness;
}

fn rings(p: vec3f, tt: f32) -> f32 {
    let p2 = p.xz;
    var d = 1e10;
    
    // Concentric rings
    d = min(d, hexRing(p2, 1.5, 0.02));
    d = min(d, triRing(p2, 1.2, 0.015));
    d = min(d, abs(length(p2) - 0.9) - 0.01);
    
    return d;
}

// ============================================================================
// Kaleidoscope Effect (Agent 3 will enhance)
// ============================================================================
fn kalei(p: vec3f) -> vec3f {
    var pos = p;
    var col = vec3f(0.0);
    
    // Iterative distortion
    for (var i: i32 = 0; i < 5; i = i + 1) {
        pos = abs(pos) - 0.5;
        pos = repeat(pos, vec3f(1.0));
        let p2 = pModPolar(pos.xy, 6.0);
        pos = vec3f(p2.x, p2.y, pos.z);
        
        let pattern = sin(pos.x * 3.0 + f32(i)) * cos(pos.y * 3.0);
        col += vec3f(0.02) * pattern;
    }
    
    return col;
}

// ============================================================================
// Raymarching
// ============================================================================
fn trace(ro: vec3f, rd: vec3f) -> vec4f {
    var t = 0.0;
    var res = vec4f(-1.0);
    
    for (var i: i32 = 0; i < 100; i = i + 1) {
        let p = ro + rd * t;
        let h = map(p);
        
        if (h.x < 0.001 || t > 20.0) {
            res = vec4f(t, h.yzw);
            break;
        }
        
        t += h.x * 0.8;
    }
    
    return res;
}

fn calcNormal(p: vec3f) -> vec3f {
    let e = vec2f(EPSILON, 0.0);
    return normalize(vec3f(
        map(p + e.xyy).x - map(p - e.xyy).x,
        map(p + e.yxy).x - map(p - e.yxy).x,
        map(p + e.yyx).x - map(p - e.yyx).x
    ));
}

// ============================================================================
// Shading
// ============================================================================
fn shade(p: vec3f, n: vec3f, mat: f32, rd: vec3f) -> vec3f {
    let light_dir = normalize(vec3f(0.5, 1.0, 0.5));
    let diff = max(dot(n, light_dir), 0.0);
    let amb = 0.3;
    
    var col: vec3f;
    
    switch (i32(mat)) {
        case 0: { col = vec3f(0.8, 0.7, 0.6); } // Body
        case 1: { col = vec3f(0.9, 0.85, 0.8); } // Head
        case 2: { col = vec3f(0.7, 0.6, 0.5); } // Arms
        case 3: { col = vec3f(0.6, 0.5, 0.4); } // Legs
        case 4: { col = vec3f(0.9, 0.8, 0.7); } // Hands
        case 5: { col = vec3f(0.2, 0.3, 0.5); } // Background
        default: { col = vec3f(0.5); }
    }
    
    return col * (diff + amb);
}

// ============================================================================
// Main Image (Agent 4 will enhance end-of-pipeline)
// ============================================================================
@fragment
fn mainImage(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let uv = (fragCoord.xy - vec2f(400.0, 300.0)) / vec2f(600.0, 600.0);
    
    // Camera
    let ro = vec3f(0.0, 0.0, 3.0);
    let rd = normalize(vec3f(uv.x, uv.y, -1.5));
    
    var col = vec3f(0.05, 0.05, 0.1); // Background base
    
    // Add kaleidoscope effect
    col += kalei(ro + rd * 2.0) * 0.3;
    
    // Raymarch
    let res = trace(ro, rd);
    
    if (res.x > 0.0) {
        let p = ro + rd * res.x;
        let n = calcNormal(p);
        col = shade(p, n, res.y, rd);
        
        // Fog
        let fog = 1.0 - exp(-res.x * 0.1);
        col = mix(col, vec3f(0.05, 0.05, 0.1), fog);
    }
    
    // Add chakras
    let chakra_col = chakras(ro + rd * res.x, u_breath.time);
    col += chakra_col;
    
    // Add rings
    let ring_d = rings(ro + rd * 3.0, u_breath.time);
    if (ring_d < 0.1) {
        col += vec3f(0.3, 0.4, 0.5) * smoothstep(0.1, 0.0, ring_d);
    }
    
    // Vignette
    let vig = pow(1.0 - length(uv), 2.0);
    col *= vig * 0.5 + 0.5;
    
    // Gamma correction
    col = pow(col, vec3f(1.0 / 2.2));
    
    return vec4f(col, 1.0);
}
