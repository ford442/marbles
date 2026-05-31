/**
 * Particle System — Lightweight CPU simulation + Filament instancing
 * 
 * Provides efficient particle effects for trails, impacts, and environmental ambience.
 * Uses pooled particles with CPU simulation and Filament instancing for rendering.
 */

export class ParticleSystem {
    constructor(engine, sceneOrQuality, Filament = null, quality = null) {
        this.engine = engine
        
        // Handle flexible constructor signature:
        // ParticleSystem(engine, quality) for testing
        // ParticleSystem(engine, scene, Filament, quality) for production
        if (typeof sceneOrQuality === 'string') {
            // Called with (engine, quality) - testing mode
            this.scene = null
            this.Filament = null
            this.quality = sceneOrQuality
        } else {
            // Called with (engine, scene, Filament, quality) - production mode
            this.scene = sceneOrQuality
            this.Filament = Filament
            this.quality = quality || 'medium'
        }
        
        // Quality-tiered budgets
        const budgets = {
            low: 50,
            medium: 200,
            high: 600,
            ultra: 1200
        }
        this.maxParticles = budgets[this.quality] || budgets.medium
        this.activeParticles = []
        
        // Particle pool (preallocated)
        this.particles = []
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                pos: [0, 0, 0],
                vel: [0, 0, 0],
                life: 0,
                maxLife: 1,
                size: 0.2,
                color: [1, 1, 1, 1],
                type: 'default',
                active: false,
                // Type-specific fields
                drag: 0.8,
                gravity: true,
                spin: 0,
                spinRate: 0
            })
        }
        
        // Billboard mesh (shared for all particles)
        this.billboardVb = null
        this.billboardIb = null
        this.billboardMaterial = null
        this.initBillboardMesh()
        
        // Instance data buffer (position, size, color)
        this.instanceData = new Float32Array(this.maxParticles * 8) // pos(3) + size(1) + color(4)
        this.particleEntity = null

        // Ambient zone emitters (continuously emit environmental particles)
        this.ambientEmitters = []
        
        // Statistics
        this.stats = {
            activeCount: 0,
            emittedThisFrame: 0
        }
    }

    /**
     * Register a continuous ambient particle emitter for a zone.
     * @param {object} config - { pos: {x,y,z}, type, rate (per second), count, params, spread }
     */
    addAmbientEmitter(config) {
        this.ambientEmitters.push({
            pos: config.pos,
            type: config.type || 'dust',
            rate: config.rate || 1.0,
            count: config.count || 1,
            params: config.params || {},
            spread: config.spread || 0,
            timer: Math.random() // stagger initial burst
        })
    }

    /**
     * Remove all ambient emitters (call on zone unload).
     */
    clearAmbientEmitters() {
        this.ambientEmitters = []
    }
    
    initBillboardMesh() {
        // Skip if Filament is not available (e.g., in testing)
        if (!this.engine || !this.Filament) {
            console.warn('[ParticleSystem] Filament not available, skipping billboard mesh setup')
            return
        }
        
        // Simple quad: two triangles forming a square
        // Vertices: [x, y, z, u, v]
        const positions = new Float32Array([
            -0.5, -0.5, 0, 0, 0,  // bottom-left
             0.5, -0.5, 0, 1, 0,  // bottom-right
             0.5,  0.5, 0, 1, 1,  // top-right
            -0.5,  0.5, 0, 0, 1   // top-left
        ])
        
        const indices = new Uint16Array([
            0, 1, 2,  // First triangle
            0, 2, 3   // Second triangle
        ])
        
        // Create vertex buffer
        try {
            this.billboardVb = this.Filament.VertexBuffer.Builder()
                .bufferCount(1)
                .vertexCount(4)
                .attribute(this.Filament['VertexAttribute']['POSITION'], 0, this.Filament['ComponentType']['FLOAT'], 0, 20)
                .attribute(this.Filament['VertexAttribute']['UV0'], 0, this.Filament['ComponentType']['FLOAT'], 12, 20)
                .normalized(this.Filament['VertexAttribute']['COLOR'])
                .build(this.engine)
            
            this.billboardVb.setBufferAt(this.engine, 0, positions)
            
            // Create index buffer
            this.billboardIb = this.Filament.IndexBuffer.Builder()
                .elementCount(6)
                .indexType(this.Filament['IndexType']['USHORT'])
                .build(this.engine)
            
            this.billboardIb.setBuffer(this.engine, indices)
        } catch (e) {
            console.warn('[ParticleSystem] Failed to create billboard mesh:', e.message)
        }
    }
    
    /**
     * Emit particles of a given type
     * @param {string} type - Particle type ('trail', 'impact', 'spark', 'bubble', 'dust')
     * @param {object} pos - Position {x, y, z}
     * @param {number} count - Number of particles to emit
     * @param {object} params - Type-specific parameters
     */
    emitParticles(type, pos, count, params = {}) {
        if (!pos || count <= 0) return
         
        const numToEmit = Math.min(count, this.activeParticles.length < this.maxParticles 
            ? this.maxParticles - this.activeParticles.length 
            : 0)
         
        for (let i = 0; i < numToEmit; i++) {
            let particle = null
             
            // Find inactive particle from pool
            for (let j = 0; j < this.particles.length; j++) {
                if (!this.particles[j].active) {
                    particle = this.particles[j]
                    break
                }
            }
             
            if (!particle) break
             
            // Initialize particle based on type
            this.initParticle(particle, type, pos, params)
            particle.active = true
            this.activeParticles.push(particle)
        }
         
        this.stats.emittedThisFrame += numToEmit
        this.stats.activeCount = this.activeParticles.length // Update active count to reflect new particles
    }
    
    initParticle(particle, type, pos, params) {
        particle.type = type
        particle.pos = [pos.x, pos.y, pos.z]
        particle.vel = [0, 0, 0]
        particle.active = true
        particle.life = params.lifetime || 1.0
        particle.maxLife = particle.life
        particle.size = params.size || 0.2
        particle.color = params.color ? [...params.color, 1.0] : [1, 1, 1, 1]
        
        // Type-specific initialization
        switch(type) {
            case 'trail':
                this.initTrailParticle(particle, params)
                break
            case 'impact':
                this.initImpactParticle(particle, params)
                break
            case 'spark':
                this.initSparkParticle(particle, params)
                break
            case 'bubble':
                this.initBubbleParticle(particle, params)
                break
            case 'dust':
                this.initDustParticle(particle, params)
                break
            default:
                particle.drag = 0.95
                particle.gravity = true
        }
    }
    
    initTrailParticle(particle, params) {
        // Speed trail: follows velocity direction, fades out
        const vel = params.velocity || [0, 0, 0]
        particle.vel = [vel[0] * 0.5, vel[1] * 0.5, vel[2] * 0.5]
        particle.drag = 0.85
        particle.gravity = false
        particle.size = params.size || 0.15
        particle.life = params.lifetime || 0.3
        particle.maxLife = particle.life
    }
    
    initImpactParticle(particle, params) {
        // Impact burst: explosive spread pattern
        const force = params.force || 5.0
        const angle1 = Math.random() * Math.PI * 2
        const angle2 = Math.random() * Math.PI * 0.5
        const speed = 1 + Math.random() * force
        
        particle.vel = [
            Math.sin(angle2) * Math.cos(angle1) * speed,
            Math.cos(angle2) * speed,
            Math.sin(angle2) * Math.sin(angle1) * speed
        ]
        particle.drag = 0.90
        particle.gravity = true
        particle.size = params.size || 0.25
        particle.life = params.lifetime || 0.8
        particle.maxLife = particle.life
    }
    
    initSparkParticle(particle, params) {
        // Sparks: fast-moving, gravity-affected
        const angle = Math.random() * Math.PI * 2
        const speed = 3 + Math.random() * 5
        
        particle.vel = [
            Math.cos(angle) * speed,
            Math.random() * 3,
            Math.sin(angle) * speed
        ]
        particle.drag = 0.92
        particle.gravity = true
        particle.size = params.size || 0.1
        particle.life = params.lifetime || 0.6
        particle.maxLife = particle.life
        particle.color = params.color || [1, 0.7, 0.3, 1]
    }
    
    initBubbleParticle(particle, params) {
        // Bubbles: rise upward slowly
        particle.vel = [
            (Math.random() - 0.5) * 0.5,  // slight sideways drift
            params.buoyancy || 1.5,         // upward velocity
            (Math.random() - 0.5) * 0.5
        ]
        particle.drag = 0.98
        particle.gravity = false
        particle.size = params.size || 0.2
        particle.life = params.lifetime || 3.0
        particle.maxLife = particle.life
        particle.color = params.color || [0.3, 0.7, 1, 0.5]
    }
    
    initDustParticle(particle, params) {
        // Dust: slow-moving, settles
        particle.vel = [
            (Math.random() - 0.5) * 2,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 2
        ]
        particle.drag = 0.96
        particle.gravity = true
        particle.size = params.size || 0.15
        particle.life = params.lifetime || 1.5
        particle.maxLife = particle.life
        particle.color = params.color || [0.6, 0.6, 0.5, 0.7]
    }
    
    /**
     * Update particle simulation
     * @param {number} deltaTime - Frame time in seconds
     */
    update(deltaTime) {
        this.stats.activeCount = 0
        this.stats.emittedThisFrame = 0
        
        // Tick ambient zone emitters
        for (const emitter of this.ambientEmitters) {
            emitter.timer += deltaTime
            const interval = 1.0 / emitter.rate
            while (emitter.timer >= interval) {
                emitter.timer -= interval
                const s = emitter.spread
                const emitPos = s > 0
                    ? { x: emitter.pos.x + (Math.random() - 0.5) * s,
                        y: emitter.pos.y + (Math.random() - 0.5) * s * 0.25,
                        z: emitter.pos.z + (Math.random() - 0.5) * s }
                    : emitter.pos
                this.emitParticles(emitter.type, emitPos, emitter.count, emitter.params)
            }
        }
        
        const g = [0, -9.81, 0] // gravity
        const gdt = [g[0] * deltaTime, g[1] * deltaTime, g[2] * deltaTime]
        
        // Update all active particles
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i]
            
            // Decay lifetime
            p.life -= deltaTime
            
            if (p.life <= 0) {
                // Particle is dead, remove from active list
                p.active = false
                this.activeParticles.splice(i, 1)
                continue
            }
            
            // Apply forces
            if (p.gravity) {
                p.vel[0] += gdt[0]
                p.vel[1] += gdt[1]
                p.vel[2] += gdt[2]
            }
            
            // Apply drag
            const dragFactor = Math.pow(p.drag, deltaTime)
            p.vel[0] *= dragFactor
            p.vel[1] *= dragFactor
            p.vel[2] *= dragFactor
            
            // Update position
            p.pos[0] += p.vel[0] * deltaTime
            p.pos[1] += p.vel[1] * deltaTime
            p.pos[2] += p.vel[2] * deltaTime
            
            this.stats.activeCount++
        }
        
        // Update instance buffer for rendering
        this.updateInstanceBuffer()
    }
    
    updateInstanceBuffer() {
        const data = this.instanceData
        
        for (let i = 0; i < this.activeParticles.length; i++) {
            const p = this.activeParticles[i]
            const offset = i * 8
            
            // Position
            data[offset + 0] = p.pos[0]
            data[offset + 1] = p.pos[1]
            data[offset + 2] = p.pos[2]
            
            // Size
            data[offset + 3] = p.size
            
            // Color (with alpha fade)
            const alpha = Math.max(0, p.life / p.maxLife)
            data[offset + 4] = p.color[0]
            data[offset + 5] = p.color[1]
            data[offset + 6] = p.color[2]
            data[offset + 7] = (p.color[3] || 1.0) * alpha
        }
    }
    
    /**
     * Render particles (called from rendering pipeline)
     * Note: This is a placeholder. Real implementation would use Filament instancing.
     */
    render() {
        // In a real implementation, this would use Filament's instancing
        // to render all active particles with a single draw call.
        // For now, the game loop handles integration separately.
    }
    
    /**
     * Get particle system statistics
     */
    getStats() {
        return {
            ...this.stats,
            poolSize: this.particles.length,
            maxParticles: this.maxParticles,
            activeParticles: this.activeParticles.length
        }
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        // The Filament engine manages the VB/IB cleanup
        this.activeParticles = []
        this.particles = []
    }
}

export default ParticleSystem
