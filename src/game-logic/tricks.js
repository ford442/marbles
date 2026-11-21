import { audio } from '../audio.js';

export class GameLogicTricks {
    constructor(game) {
        this.game = game;
    }

    performStompImpact(multiplier = 1.0) {
        if (!this.game.playerMarble) return

        if (audio.playStomp) audio.playStomp()

        const center = this.game.playerMarble.rigidBody.translation()
        const radius = 15.0 * multiplier
        const force = 100.0 * multiplier

        const applyForce = (body) => {
            const t = body.translation()
            const dx = t.x - center.x
            const dy = t.y - center.y
            const dz = t.z - center.z
            const dist = Math.hypot(dx, dy, dz)

            if (dist < radius && dist > 0.1) {
                const factor = 1.0 - (dist / radius)
                const nx = dx / dist
                const ny = dy / dist
                const nz = dz / dist

                body.applyImpulse({
                    x: nx * force * factor,
                    y: (ny * 0.5 + 0.5) * force * factor,
                    z: nz * force * factor
                }, true)
            }
        }

        for (const m of this.game.marbles) {
            if (m !== this.game.playerMarble) {
                applyForce(m.rigidBody)
            }
        }
        for (const obj of this.game.dynamicObjects) {
            applyForce(obj.rigidBody)
        }

        if (this.game.playerMarble.color) {
            const rcm = this.game.engine.getRenderableManager()
            const inst = rcm.getInstance(this.game.playerMarble.entity)
            rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, this.game.playerMarble.color)
        }

        // Add a visual particle ring at the impact point
        this.game.effectPool?.spawnVisualParticle({
            color: [1.0, 0.2, 0.0],
            roughness: 0.8,
            spawnTime: Date.now(),
            pos: { x: center.x, y: center.y - 0.4, z: center.z },
            vel: { x: 0, y: 0, z: 0 }, // It expands rather than moves
            duration: 500 * (multiplier * 0.5),
            scale: 1.0,
            isEMPRing: true, // Use the existing EMP expanding ring logic
            startRadius: 0.1,
            maxRadius: radius
        })

        // Trigger camera shake proportional to impact
        if (!this.game.cameraShake) this.game.cameraShake = { x: 0, y: 0, z: 0 }
        const shakeIntensity = multiplier * 2.0
        this.game.cameraShake.x += (Math.random() - 0.5) * shakeIntensity
        this.game.cameraShake.y += (Math.random() - 0.5) * shakeIntensity
        this.game.cameraShake.z += (Math.random() - 0.5) * shakeIntensity
    }

    awardTrickPoints(message, points, color) {
        if (audio && audio.playCollect) audio.playCollect()

        this.game.combo = Math.min(10, this.game.combo + 1)
        this.game.comboTimer = Date.now()
        if (this.game.comboEl) {
            this.game.comboEl.style.display = 'block'
            this.game.comboEl.textContent = `Combo: x${this.game.combo}`
            this.game.comboEl.style.transform = 'scale(1.2)'
            setTimeout(() => { if (this.game.comboEl) this.game.comboEl.style.transform = 'scale(1)' }, 100)
        }
        if (this.game.combobarContainerEl) this.game.combobarContainerEl.style.display = 'block'

        this.game.bankedTrickScore = (this.game.bankedTrickScore || 0) + points

        this.game.showTrickMessage(message + ` +${points}`, color)
    }

    showTrickMessage(text, color) {
        const uiContainer = document.getElementById('ui')
        if (!uiContainer) return

        const msgEl = document.createElement('div')
        msgEl.textContent = text
        msgEl.style.position = 'absolute'
        // random position around the center-ish of the UI
        msgEl.style.left = '200px'
        msgEl.style.top = (150 + Math.random() * 50) + 'px'
        msgEl.style.color = color || '#ffffff'
        msgEl.style.fontWeight = 'bold'
        msgEl.style.fontSize = '24px'
        msgEl.style.textShadow = '2px 2px 0 #000'
        msgEl.style.transition = 'all 1.5s ease-out'
        msgEl.style.pointerEvents = 'none'
        msgEl.style.zIndex = '100'

        uiContainer.appendChild(msgEl)

        // Force reflow
        msgEl.getBoundingClientRect()

        msgEl.style.top = (parseInt(msgEl.style.top) - 50) + 'px'
        msgEl.style.opacity = '0'
        msgEl.style.transform = 'scale(1.5)'

        setTimeout(() => {
            if (msgEl.parentNode) {
                msgEl.parentNode.removeChild(msgEl)
            }
        }, 1500)
    }

    spawnDriftSparks(pos) {
        if (!this.game.visualParticles) return

        const count = this.game.effectPool?.budget.getVisualBurstCount(3) ?? 3
        for (let i = 0; i < count; i++) {
            const isYellow = Math.random() > 0.5
            const color = isYellow ? [1.0, 1.0, 0.0] : [1.0, 0.5, 0.0]
            const angle = Math.random() * Math.PI * 2
            const speed = 2.0 + Math.random() * 3.0

            this.game.effectPool?.spawnVisualParticle({
                color,
                roughness: 0.2,
                spawnTime: Date.now(),
                pos: { x: pos.x, y: pos.y, z: pos.z },
                vel: {
                    x: Math.cos(angle) * speed,
                    y: 2.0 + Math.random() * 2.0,
                    z: Math.sin(angle) * speed
                },
                duration: 200 + Math.random() * 200,
                isCollectionRay: true,
                angle
            })
        }
    }
}
