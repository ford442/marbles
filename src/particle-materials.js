/**
 * Particle Materials and Rendering
 * 
 * Provides simple materials for particle effects (trails, impacts, sparks, etc.)
 * Uses Filament's transparent materials for billboard rendering.
 */

export function createParticleMaterial(engine, Filament) {
    // Create a simple transparent material for particles
    // This uses Filament's built-in material system
    
    // For now, return a simple transparent material config
    // In a full implementation, we'd create custom Filament materials
    return {
        type: 'particle',
        transparent: true,
        blending: 'add',  // Additive blending for particle effects
        depthWrite: false,
        depthTest: true,
        
        // Color and alpha are set per-particle via uniforms/instancing
        baseColor: [1, 1, 1, 1],
        
        // Material properties
        roughness: 0.8,
        metallic: 0.0,
        
        // Enable soft particles (fade near geometry)
        softParticles: true
    }
}

/**
 * Helper to create particle emitters for common effects
 */
export class ParticleEmitters {
    static createSpeedTrail(particleSystem, marblePos, marbleVel, marbleColor, strength = 1.0) {
        // Emit 1-2 particles behind the marble based on speed
        const speed = Math.sqrt(marbleVel[0] ** 2 + marbleVel[1] ** 2 + marbleVel[2] ** 2)
        
        if (speed > 2) {  // Only emit if moving fast
            const count = Math.floor(speed * 0.5) + 1
            particleSystem.emitParticles('trail', marblePos, count, {
                velocity: marbleVel,
                lifetime: 0.3,
                color: marbleColor,
                size: 0.2
            })
        }
    }
    
    static createImpactBurst(particleSystem, collisionPos, collisionNormal = null) {
        particleSystem.emitParticles('impact', collisionPos, 15, {
            force: 4.0,
            lifetime: 0.8,
            color: [1, 0.8, 0.5, 1],
            size: 0.2
        })
    }
    
    static createBoostJet(particleSystem, marblePos, marbleVel, boostColor) {
        // Emit particles backwards (opposite to velocity)
        const backwardVel = [-marbleVel[0], -marbleVel[1] * 0.5, -marbleVel[2]]
        
        particleSystem.emitParticles('spark', marblePos, 5, {
            velocity: backwardVel,
            lifetime: 0.5,
            color: boostColor,
            size: 0.15
        })
    }
    
    static createAbyssalBubbles(particleSystem, spawnPos, count = 2) {
        particleSystem.emitParticles('bubble', spawnPos, count, {
            lifetime: 3.0,
            buoyancy: 1.2,
            color: [0.2, 0.8, 1, 0.6],
            size: 0.2
        })
    }
    
    static createVolcanicSparks(particleSystem, spawnPos, count = 8) {
        particleSystem.emitParticles('spark', spawnPos, count, {
            force: 3.0,
            lifetime: 0.8,
            color: [1, 0.6, 0.2, 1],
            size: 0.15
        })
    }
    
    static createDustPuff(particleSystem, spawnPos, count = 5) {
        particleSystem.emitParticles('dust', spawnPos, count, {
            lifetime: 1.5,
            color: [0.7, 0.65, 0.6, 0.8],
            size: 0.2
        })
    }
}

export default {
    createParticleMaterial,
    ParticleEmitters
}
