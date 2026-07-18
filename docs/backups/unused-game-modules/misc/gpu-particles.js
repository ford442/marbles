/**
 * GPU Particle System — WebGL2 Transform Feedback Prototype
 *
 * Offloads particle simulation from the CPU to the GPU using WebGL2
 * transform feedback. This prototype is designed to run alongside
 * Filament (which owns the primary WebGL context) by creating a
 * secondary offscreen context or by sharing buffers via Filament's
 * underlying GL context if exposed.
 *
 * Current architecture:
 *   - CPU: spawn / kill particles, set initial state
 *   - GPU: update positions, velocities, lifetimes each frame
 *   - Render: instanced billboards or point sprites
 *
 * Integration note: To use with Filament, retrieve the shared GL
 * context via `engine.getBackend().getContext()` (Filament C++ API)
 * or render this system to an offscreen canvas and composite.
 */

const PARTICLE_FLOATS = 8 // px, py, pz, vx, vy, vz, life, maxLife

const VERTEX_SHADER = `
    #version 300 es
    precision highp float;

    layout(location = 0) in vec3 a_position;
    layout(location = 1) in vec3 a_velocity;
    layout(location = 2) in vec2 a_life; // x = current, y = max

    out vec3 v_position;
    out vec3 v_velocity;
    out vec2 v_life;

    uniform float u_deltaTime;
    uniform vec3 u_gravity;
    uniform float u_drag;

    void main() {
        float dt = u_deltaTime;
        vec3 vel = a_velocity;

        // Apply gravity and drag
        vel += u_gravity * dt;
        vel *= (1.0 - u_drag * dt);

        // Update position
        vec3 pos = a_position + vel * dt;

        // Decay life
        float life = a_life.x - dt;

        v_position = pos;
        v_velocity = vel;
        v_life = vec2(life, a_life.y);
    }
`

const FRAGMENT_SHADER = `
    #version 300 es
    precision highp float;

    in float f_lifeRatio;
    in vec2 f_uv;

    out vec4 fragColor;

    uniform vec4 u_colorStart;
    uniform vec4 u_colorEnd;
    uniform float u_size;

    void main() {
        // Circular particle
        float dist = length(f_uv - 0.5) * 2.0;
        if (dist > 1.0) discard;

        // Soft edge
        float alpha = 1.0 - smoothstep(0.6, 1.0, dist);

        // Color fade over life
        vec4 color = mix(u_colorStart, u_colorEnd, 1.0 - f_lifeRatio);
        color.a *= alpha * f_lifeRatio; // fade in/out

        fragColor = color;
    }
`

const BILLBOARD_VERTEX = `
    #version 300 es
    precision highp float;

    layout(location = 0) in vec3 a_position;
    layout(location = 1) in vec3 a_velocity;
    layout(location = 2) in vec2 a_life;
    layout(location = 3) in vec2 a_billboard; // {-1,-1}, {1,-1}, {-1,1}, {1,1}

    out float f_lifeRatio;
    out vec2 f_uv;

    uniform mat4 u_viewProj;
    uniform vec3 u_cameraRight;
    uniform vec3 u_cameraUp;
    uniform float u_size;

    void main() {
        float lifeRatio = clamp(a_life.x / a_life.y, 0.0, 1.0);
        float size = u_size * (1.0 + (1.0 - lifeRatio) * 0.5); // grow as it dies

        vec3 worldPos = a_position
            + u_cameraRight * a_billboard.x * size
            + u_cameraUp    * a_billboard.y * size;

        gl_Position = u_viewProj * vec4(worldPos, 1.0);
        f_lifeRatio = lifeRatio;
        f_uv = a_billboard * 0.5 + 0.5;
    }
`

export class GPUParticleSystem {
    constructor(gl, maxParticles = 1024) {
        this.gl = gl
        this.maxParticles = maxParticles
        this.activeCount = 0

        this.gravity = [0, -2.0, 0]
        this.drag = 0.5
        this.size = 0.15
        this.colorStart = [1.0, 0.8, 0.2, 1.0]
        this.colorEnd = [1.0, 0.1, 0.0, 0.0]

        this._initBuffers()
        this._initShaders()
        this._initVAOs()
    }

    _initBuffers() {
        const gl = this.gl
        const bytes = this.maxParticles * PARTICLE_FLOATS * 4

        this.bufA = gl.createBuffer()
        this.bufB = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufA)
        gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_DRAW)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufB)
        gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_DRAW)

        this.readBuf = this.bufA
        this.writeBuf = this.bufB

        // Billboard corner offsets (quad per particle)
        const corners = new Float32Array([-1,-1, 1,-1, -1,1, 1,1])
        this.billboardBuf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.billboardBuf)
        gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW)
    }

    _initShaders() {
        const gl = this.gl

        // Transform feedback program
        const vs = gl.createShader(gl.VERTEX_SHADER)
        gl.shaderSource(vs, VERTEX_SHADER)
        gl.compileShader(vs)

        this.tfProgram = gl.createProgram()
        gl.attachShader(this.tfProgram, vs)
        gl.transformFeedbackVaryings(this.tfProgram,
            ['v_position', 'v_velocity', 'v_life'],
            gl.SEPARATE_ATTRIBS)
        gl.linkProgram(this.tfProgram)

        if (!gl.getProgramParameter(this.tfProgram, gl.LINK_STATUS)) {
            console.error('[GPUParticles] TF link error:', gl.getProgramInfoLog(this.tfProgram))
        }

        // Render program
        const rvs = gl.createShader(gl.VERTEX_SHADER)
        gl.shaderSource(rvs, BILLBOARD_VERTEX)
        gl.compileShader(rvs)
        const fs = gl.createShader(gl.FRAGMENT_SHADER)
        gl.shaderSource(fs, FRAGMENT_SHADER)
        gl.compileShader(fs)

        this.renderProgram = gl.createProgram()
        gl.attachShader(this.renderProgram, rvs)
        gl.attachShader(this.renderProgram, fs)
        gl.linkProgram(this.renderProgram)

        if (!gl.getProgramParameter(this.renderProgram, gl.LINK_STATUS)) {
            console.error('[GPUParticles] Render link error:', gl.getProgramInfoLog(this.renderProgram))
        }
    }

    _initVAOs() {
        const gl = this.gl

        // TF input VAO
        this.tfVAO = gl.createVertexArray()
        gl.bindVertexArray(this.tfVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.readBuf)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, PARTICLE_FLOATS * 4, 0)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, PARTICLE_FLOATS * 4, 12)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, PARTICLE_FLOATS * 4, 24)

        // Render VAO
        this.renderVAO = gl.createVertexArray()
        gl.bindVertexArray(this.renderVAO)
        // Particle state
        gl.bindBuffer(gl.ARRAY_BUFFER, this.readBuf)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, PARTICLE_FLOATS * 4, 0)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, PARTICLE_FLOATS * 4, 12)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, PARTICLE_FLOATS * 4, 24)
        // Instance divisors
        gl.vertexAttribDivisor(0, 1)
        gl.vertexAttribDivisor(1, 1)
        gl.vertexAttribDivisor(2, 1)
        // Billboard corners
        gl.bindBuffer(gl.ARRAY_BUFFER, this.billboardBuf)
        gl.enableVertexAttribArray(3)
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0)
        gl.vertexAttribDivisor(3, 0)

        gl.bindVertexArray(null)
    }

    /**
     * Spawn particles from CPU.
     * @param {Array<{position: number[], velocity: number[], life: number}>} particles
     */
    spawn(particles) {
        if (particles.length === 0) return
        const gl = this.gl

        // Read current buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.readBuf)
        const existing = new Float32Array(this.maxParticles * PARTICLE_FLOATS)
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, existing)

        let written = this.activeCount
        for (const p of particles) {
            if (written >= this.maxParticles) break
            const i = written * PARTICLE_FLOATS
            existing[i]     = p.position[0]
            existing[i + 1] = p.position[1]
            existing[i + 2] = p.position[2]
            existing[i + 3] = p.velocity[0]
            existing[i + 4] = p.velocity[1]
            existing[i + 5] = p.velocity[2]
            existing[i + 6] = p.life
            existing[i + 7] = p.life
            written++
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.readBuf)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, existing)
        this.activeCount = written
    }

    /**
     * Update particles on GPU via transform feedback.
     * @param {number} deltaTime
     */
    update(deltaTime) {
        if (this.activeCount === 0) return
        const gl = this.gl

        gl.useProgram(this.tfProgram)
        gl.uniform1f(gl.getUniformLocation(this.tfProgram, 'u_deltaTime'), deltaTime)
        gl.uniform3f(gl.getUniformLocation(this.tfProgram, 'u_gravity'), ...this.gravity)
        gl.uniform1f(gl.getUniformLocation(this.tfProgram, 'u_drag'), this.drag)

        gl.bindVertexArray(this.tfVAO)

        // Bind output buffers for transform feedback
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.writeBuf)
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.writeBuf)
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, this.writeBuf)

        gl.enable(gl.RASTERIZER_DISCARD)
        gl.beginTransformFeedback(gl.POINTS)
        gl.drawArrays(gl.POINTS, 0, this.activeCount)
        gl.endTransformFeedback()
        gl.disable(gl.RASTERIZER_DISCARD)

        // Ping-pong
        const tmp = this.readBuf
        this.readBuf = this.writeBuf
        this.writeBuf = tmp

        // Update VAOs to point to new read buffer
        gl.bindVertexArray(this.tfVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.readBuf)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, PARTICLE_FLOATS * 4, 0)
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, PARTICLE_FLOATS * 4, 12)
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, PARTICLE_FLOATS * 4, 24)

        gl.bindVertexArray(this.renderVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.readBuf)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, PARTICLE_FLOATS * 4, 0)
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, PARTICLE_FLOATS * 4, 12)
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, PARTICLE_FLOATS * 4, 24)

        gl.bindVertexArray(null)

        // CPU-side life culling (simplified: just trim count when buffer has many dead)
        // A full GPU culling pass would use a compute shader or indirect draw.
    }

    /**
     * Render particles as camera-facing billboards.
     * @param {Float32Array} viewProj  4x4 column-major view-projection matrix
     * @param {Float32Array} cameraRight  World-space right vector
     * @param {Float32Array} cameraUp     World-space up vector
     */
    render(viewProj, cameraRight, cameraUp) {
        if (this.activeCount === 0) return
        const gl = this.gl

        gl.useProgram(this.renderProgram)
        gl.uniformMatrix4fv(gl.getUniformLocation(this.renderProgram, 'u_viewProj'), false, viewProj)
        gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_cameraRight'), ...cameraRight)
        gl.uniform3f(gl.getUniformLocation(this.renderProgram, 'u_cameraUp'), ...cameraUp)
        gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'u_size'), this.size)
        gl.uniform4f(gl.getUniformLocation(this.renderProgram, 'u_colorStart'), ...this.colorStart)
        gl.uniform4f(gl.getUniformLocation(this.renderProgram, 'u_colorEnd'), ...this.colorEnd)

        gl.bindVertexArray(this.renderVAO)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.depthMask(false)

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.activeCount)

        gl.depthMask(true)
        gl.disable(gl.BLEND)
        gl.bindVertexArray(null)
    }

    destroy() {
        const gl = this.gl
        gl.deleteBuffer(this.bufA)
        gl.deleteBuffer(this.bufB)
        gl.deleteBuffer(this.billboardBuf)
        gl.deleteProgram(this.tfProgram)
        gl.deleteProgram(this.renderProgram)
        gl.deleteVertexArray(this.tfVAO)
        gl.deleteVertexArray(this.renderVAO)
    }
}

/**
 * Factory presets for common particle effects.
 */
export const particlePresets = {
    goalFountain: {
        gravity: [0, -4.0, 0],
        drag: 0.3,
        size: 0.08,
        colorStart: [1.0, 0.9, 0.2, 1.0],
        colorEnd: [1.0, 0.3, 0.0, 0.0],
    },
    empShockwave: {
        gravity: [0, 0, 0],
        drag: 1.5,
        size: 0.2,
        colorStart: [0.0, 1.0, 1.0, 1.0],
        colorEnd: [0.0, 0.3, 0.5, 0.0],
    },
    collectionSparkle: {
        gravity: [0, -1.5, 0],
        drag: 0.8,
        size: 0.05,
        colorStart: [1.0, 1.0, 0.8, 1.0],
        colorEnd: [1.0, 0.5, 0.0, 0.0],
    },
    checkpointBurst: {
        gravity: [0, -2.5, 0],
        drag: 0.5,
        size: 0.1,
        colorStart: [0.0, 0.8, 1.0, 1.0],
        colorEnd: [0.0, 0.2, 0.5, 0.0],
    },
}
