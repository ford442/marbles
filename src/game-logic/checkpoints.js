import { audio } from '../audio.js';

export class GameLogicCheckpoints {
    /**
     * Activates a checkpoint with visual effects:
     * - Screen flash (200-300ms white fade)
     * - Particle burst (30-50 particles, cyan/blue, upward burst)
     * - Ring pulse (expanding cyan ring)
     * - Enhanced glow on checkpoint material and point light
     */
    activateCheckpoint(checkpoint, marble) {
        if (checkpoint.activated) return
        
        checkpoint.activated = true
        
        // Change material to bright green/yellow activated color
        if (checkpoint.matInstance) {
            checkpoint.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.9, 0.0])
            checkpoint.matInstance.setFloatParameter('roughness', 0.2)
        }
        
        // Enhance point light if present
        if (checkpoint.lightEntity) {
            const lightManager = this.engine.getLightManager()
            const lightInst = lightManager.getInstance(checkpoint.lightEntity)
            lightManager.setIntensity(lightInst, 50000.0) // Boost intensity
            lightManager.setColor(lightInst, [0.0, 1.0, 0.5]) // Shift to green
        }
        
        // Trigger screen flash
        this.triggerCheckpointFlash()
        
        // Create particle burst
        this.createCheckpointParticles(checkpoint.pos)
        
        // Create ring pulse
        this.createCheckpointRing(checkpoint.pos)
        
        // Play sound
        audio.playGoal()
        
        // Update respawn position
        marble.respawnPos = { x: checkpoint.pos.x, y: checkpoint.pos.y + 1.0, z: checkpoint.pos.z }
        
        if (this.levelStartTime) {
            const splitTimeMs = Date.now() - this.levelStartTime;
            const splitTimeSec = (splitTimeMs / 1000).toFixed(2);
            this.showTrickMessage(`Checkpoint! Split: ${splitTimeSec}s`, '#00ff00');
        }

        console.log(`[GAME] Checkpoint activated by ${marble.name || 'marble'}! New respawn set.`)
    }
    
    /**
     * Triggers a brief white screen flash overlay
     */
    triggerCheckpointFlash() {
        const flashOverlay = document.getElementById('checkpoint-flash-overlay')
        if (!flashOverlay) return
        
        // Reset and trigger flash
        flashOverlay.style.opacity = '0.8'
        flashOverlay.style.transition = 'none'
        
        // Force reflow
        flashOverlay.getBoundingClientRect()
        
        // Fade out over 250ms
        flashOverlay.style.transition = 'opacity 250ms ease-out'
        flashOverlay.style.opacity = '0'
    }
    
    /**
     * Creates a burst of 30-50 cyan/blue particles from checkpoint position
     */
    createCheckpointParticles(pos) {
        const particleCount = 35 + Math.floor(Math.random() * 15) // 35-50 particles
        
        for (let i = 0; i < particleCount; i++) {
            const particleEntity = this.Filament.EntityManager.get().create()
            const particleMat = this.material.createInstance()
            
            // Cyan/blue color variations
            const hue = Math.random()
            const r = 0.0
            const g = 0.6 + hue * 0.4  // 0.6 to 1.0
            const b = 0.8 + hue * 0.2  // 0.8 to 1.0
            
            particleMat.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
            particleMat.setFloatParameter('roughness', 0.3)
            
            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [0.1, 0.1, 0.1] })
                .material(0, particleMat)
                .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
                .receiveShadows(false)
                .castShadows(false)
                .build(this.engine, particleEntity)
            
            this.scene.addEntity(particleEntity)
            
            // Random upward velocity with spread
            const angle = Math.random() * Math.PI * 2
            const spread = Math.random() * 0.5
            const upwardSpeed = 3.0 + Math.random() * 4.0
            
            this.visualParticles.push({
                entity: particleEntity,
                matInstance: particleMat,
                spawnTime: Date.now(),
                pos: { 
                    x: pos.x + (Math.random() - 0.5) * 2, 
                    y: pos.y + (Math.random() - 0.5), 
                    z: pos.z + (Math.random() - 0.5) * 2 
                },
                vel: {
                    x: Math.cos(angle) * spread,
                    y: upwardSpeed,
                    z: Math.sin(angle) * spread
                },
                duration: 1000 + Math.random() * 1000, // 1-2 seconds
                scale: 1.0,
                isCheckpointParticle: true
            })
        }
    }
    
    /**
     * Creates an expanding ring pulse from checkpoint center
     */
    createCheckpointRing(pos) {
        const ringEntity = this.Filament.EntityManager.get().create()
        const ringMat = this.material.createInstance()
        
        // Cyan ring color
        ringMat.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 0.9, 1.0])
        ringMat.setFloatParameter('roughness', 0.2)
        
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.05, 0.5] })
            .material(0, ringMat)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, ringEntity)
        
        this.scene.addEntity(ringEntity)
        
        this.visualParticles.push({
            entity: ringEntity,
            matInstance: ringMat,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: 0, y: 0, z: 0 },
            duration: 1000, // 1 second
            scale: 1.0,
            isCheckpointRing: true,
            startRadius: 1.0,
            maxRadius: 8.0 // 3x typical checkpoint size
        })
    }
}

export function applyGameLogicCheckpoints(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLogicCheckpoints.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLogicCheckpoints.prototype[name];
        }
    }
}
