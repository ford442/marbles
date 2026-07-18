import { audio } from '../audio.js';

export class GameLogicTricks {
    performStompImpact(multiplier = 1.0) {
        if (!this.playerMarble) return

        if (audio.playStomp) audio.playStomp()

        const center = this.playerMarble.rigidBody.translation()
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

        for (const m of this.marbles) {
            if (m !== this.playerMarble) {
                applyForce(m.rigidBody)
            }
        }
        for (const obj of this.dynamicObjects) {
            applyForce(obj.rigidBody)
        }

        if (this.playerMarble.color) {
            const rcm = this.engine.getRenderableManager()
            const inst = rcm.getInstance(this.playerMarble.entity)
            rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.color)
        }

        // Add a visual particle ring at the impact point
        const ringEntity = this.Filament.EntityManager.get().create()
        const ringMatInstance = this.material.createInstance()
        ringMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.2, 0.0])
        ringMatInstance.setFloatParameter('roughness', 0.8)

        const halfExtents = { x: 0.1, y: 0.1, z: 0.1 }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, ringMatInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, ringEntity)

        this.scene.addEntity(ringEntity)

        // Add to visualParticles to be animated and cleaned up in loop()
        // We'll give it a special flag or use the scale to animate it growing outward
        this.visualParticles.push({
            entity: ringEntity,
            matInstance: ringMatInstance,
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
        if (!this.cameraShake) this.cameraShake = { x: 0, y: 0, z: 0 }
        const shakeIntensity = multiplier * 2.0
        this.cameraShake.x += (Math.random() - 0.5) * shakeIntensity
        this.cameraShake.y += (Math.random() - 0.5) * shakeIntensity
        this.cameraShake.z += (Math.random() - 0.5) * shakeIntensity
    }

    awardTrickPoints(message, points, color) {
        if (audio && audio.playCollect) audio.playCollect()

        this.combo = Math.min(10, this.combo + 1)
        this.comboTimer = Date.now()
        if (this.comboEl) {
            this.comboEl.style.display = 'block'
            this.comboEl.textContent = `Combo: x${this.combo}`
            this.comboEl.style.transform = 'scale(1.2)'
            setTimeout(() => { if (this.comboEl) this.comboEl.style.transform = 'scale(1)' }, 100)
        }
        if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'block'

        this.score += points * this.combo
        if (this.scoreEl) this.scoreEl.textContent = 'Score: ' + this.score

        this.showTrickMessage(message + ` +${points * this.combo}`, color)
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
        if (!this.visualParticles) return

        for (let i = 0; i < 3; i++) {
            const rayEntity = this.Filament.EntityManager.get().create()
            const rayMatInstance = this.material.createInstance()

            // Orange/Yellow sparks
            const isYellow = Math.random() > 0.5
            const color = isYellow ? [1.0, 1.0, 0.0] : [1.0, 0.5, 0.0]

            rayMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
            rayMatInstance.setFloatParameter('roughness', 0.2)
            rayMatInstance.setFloatParameter('metallic', 0.0)

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [0.05, 0.05, 0.05] })
                .material(0, rayMatInstance)
                .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
                .receiveShadows(false)
                .castShadows(false)
                .build(this.engine, rayEntity)

            this.scene.addEntity(rayEntity)

            const angle = Math.random() * Math.PI * 2
            const speed = 2.0 + Math.random() * 3.0

            this.visualParticles.push({
                entity: rayEntity,
                matInstance: rayMatInstance,
                spawnTime: Date.now(),
                pos: { x: pos.x, y: pos.y, z: pos.z },
                vel: {
                    x: Math.cos(angle) * speed,
                    y: 2.0 + Math.random() * 2.0,
                    z: Math.sin(angle) * speed
                },
                duration: 200 + Math.random() * 200,
                isCollectionRay: true, // Reuse ray physics
                angle: angle
            })
        }
    }
}

export function applyGameLogicTricks(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLogicTricks.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLogicTricks.prototype[name];
        }
    }
}
