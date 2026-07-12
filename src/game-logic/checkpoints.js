import { audio } from '../audio.js';

export class GameLogicCheckpoints {
    activateCheckpoint(checkpoint, marble) {
        if (checkpoint.activated) return
        
        checkpoint.activated = true
        
        if (checkpoint.matInstance) {
            checkpoint.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.9, 0.0])
            checkpoint.matInstance.setFloatParameter('roughness', 0.2)
        }
        
        if (checkpoint.lightEntity) {
            const lightManager = this.engine.getLightManager()
            const lightInst = lightManager.getInstance(checkpoint.lightEntity)
            lightManager.setIntensity(lightInst, 50000.0)
            lightManager.setColor(lightInst, [0.0, 1.0, 0.5])
        }
        
        this.triggerCheckpointFlash()
        this.createCheckpointParticles(checkpoint.pos)
        this.createCheckpointRing(checkpoint.pos)
        
        if (audio.playAbility) {
            audio.playAbility('goal', checkpoint.pos)
        } else {
            audio.playGoal(checkpoint.pos)
        }
        
        marble.respawnPos = { x: checkpoint.pos.x, y: checkpoint.pos.y + 1.0, z: checkpoint.pos.z }
        
        if (this.levelStartTime) {
            const splitTimeMs = Date.now() - this.levelStartTime;
            const splitTimeSec = (splitTimeMs / 1000).toFixed(2);
            this.showTrickMessage(`Checkpoint! Split: ${splitTimeSec}s`, '#00ff00');
        }

        console.log(`[GAME] Checkpoint activated by ${marble.name || 'marble'}! New respawn set.`)
    }
    
    triggerCheckpointFlash() {
        const flashOverlay = document.getElementById('checkpoint-flash-overlay')
        if (!flashOverlay) return
        
        flashOverlay.style.opacity = '0.8'
        flashOverlay.style.transition = 'none'
        flashOverlay.getBoundingClientRect()
        flashOverlay.style.transition = 'opacity 250ms ease-out'
        flashOverlay.style.opacity = '0'
    }
    
    createCheckpointParticles(pos) {
        const requested = 35 + Math.floor(Math.random() * 15)
        const particleCount = this.effectPool?.budget.getVisualBurstCount(requested) ?? requested
        
        for (let i = 0; i < particleCount; i++) {
            const hue = Math.random()
            const r = 0.0
            const g = 0.6 + hue * 0.4
            const b = 0.8 + hue * 0.2

            const angle = Math.random() * Math.PI * 2
            const spread = Math.random() * 0.5
            const upwardSpeed = 3.0 + Math.random() * 4.0

            this.effectPool?.spawnVisualParticle({
                color: [r, g, b],
                roughness: 0.3,
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
                duration: 1000 + Math.random() * 1000,
                scale: 1.0,
                isCheckpointParticle: true
            })
        }
    }
    
    createCheckpointRing(pos) {
        this.effectPool?.spawnVisualParticle({
            color: [0.0, 0.9, 1.0],
            roughness: 0.2,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: 0, y: 0, z: 0 },
            duration: 1000,
            scale: 1.0,
            isCheckpointRing: true,
            startRadius: 1.0,
            maxRadius: 8.0
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
