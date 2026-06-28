import { audio } from '../audio.js';

export class GameLogicCollectibles {
    triggerCollectionEffect(pos, value, type = 'coin') {
        const now = Date.now()

        const colors = {
            coin: { r: 1.0, g: 0.84, b: 0.0 },
            gem: { r: 0.0, g: 0.8, b: 1.0 },
            star: { r: 1.0, g: 0.9, b: 0.2 }
        }
        const color = colors[type] || colors.coin

        const particleCount = this.effectPool?.budget.getVisualBurstCount(25) ?? 25
        for (let i = 0; i < particleCount; i++) {
            this.createCollectionParticle(pos, color, i, particleCount)
        }

        this.effectPool?.spawnVisualParticle({
            spawnTime: now,
            pos: { x: pos.x, y: pos.y, z: pos.z },
            duration: 600,
            isCollectionRing: true,
            startRadius: 0.5,
            maxRadius: 3.0,
            color,
            roughness: 0.3,
        })

        const rayCount = this.effectPool?.budget.getVisualBurstCount(8) ?? 8
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / 8) * Math.PI * 2
            const speed = 3.0 + Math.random() * 2.0
            this.effectPool?.spawnVisualParticle({
                spawnTime: now,
                pos: { x: pos.x, y: pos.y, z: pos.z },
                vel: {
                    x: Math.cos(angle) * speed,
                    y: 1.0 + Math.random() * 2.0,
                    z: Math.sin(angle) * speed
                },
                duration: 400 + Math.random() * 200,
                isCollectionRay: true,
                angle,
                color: [1.0, 1.0, 0.8],
                roughness: 0.1,
            })
        }

        this.showCollectionScorePopup(pos, value)
        this.triggerCollectionFlash(pos, color)
    }

    createCollectionParticle(pos, color, index, total) {
        const variation = 0.2
        const r = Math.min(1.0, color.r + (Math.random() - 0.5) * variation)
        const g = Math.min(1.0, color.g + (Math.random() - 0.5) * variation)
        const b = Math.min(1.0, color.b + (Math.random() - 0.5) * variation)

        const angle = (index / total) * Math.PI * 2
        const spread = 0.5 + Math.random() * 0.5
        const upwardBias = 2.0 + Math.random() * 2.0

        return this.effectPool?.spawnVisualParticle({
            color: [r, g, b],
            roughness: 0.2,
            spawnTime: Date.now(),
            pos: {
                x: pos.x + (Math.random() - 0.5) * 0.3,
                y: pos.y + (Math.random() - 0.5) * 0.3,
                z: pos.z + (Math.random() - 0.5) * 0.3
            },
            vel: {
                x: Math.cos(angle) * spread,
                y: upwardBias + Math.random() * 1.5,
                z: Math.sin(angle) * spread
            },
            duration: 500 + Math.random() * 400,
            isCollectionParticle: true,
            rotationSpeed: (Math.random() - 0.5) * 0.3
        })
    }

    showCollectionScorePopup(pos, value) {
        const uiContainer = document.getElementById('ui')
        if (!uiContainer) return

        const popup = document.createElement('div')
        const scoreText = value * this.combo
        popup.textContent = `+${scoreText}`
        popup.className = 'collection-score-popup'
        popup.style.cssText = `
            position: absolute;
            color: #ffd700;
            font-weight: bold;
            font-size: 24px;
            text-shadow: 2px 2px 0 #000, 0 0 10px #ffd700;
            pointer-events: none;
            z-index: 100;
            transform: translate(-50%, -50%) scale(0.5);
            transition: all 0.8s ease-out;
            opacity: 0;
        `

        const screenPos = this.worldToScreen(pos)
        if (screenPos) {
            popup.style.left = screenPos.x + 'px'
            popup.style.top = screenPos.y + 'px'
        } else {
            popup.style.left = '50%'
            popup.style.top = '40%'
        }

        uiContainer.appendChild(popup)

        requestAnimationFrame(() => {
            popup.style.transform = 'translate(-50%, -50%) scale(1.2)'
            popup.style.opacity = '1'

            setTimeout(() => {
                popup.style.transform = 'translate(-50%, -150%) scale(1.0)'
                popup.style.opacity = '0'
            }, 100)
        })

        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup)
            }
        }, 900)
    }

    worldToScreen(worldPos) {
        if (!this.camera || !this.view) return null

        try {
            const viewMatrix = this.camera.getViewMatrix()
            const projectionMatrix = this.camera.getProjectionMatrix()

            const viewX = viewMatrix[0] * worldPos.x + viewMatrix[4] * worldPos.y + viewMatrix[8] * worldPos.z + viewMatrix[12]
            const viewY = viewMatrix[1] * worldPos.x + viewMatrix[5] * worldPos.y + viewMatrix[9] * worldPos.z + viewMatrix[13]
            const viewZ = viewMatrix[2] * worldPos.x + viewMatrix[6] * worldPos.y + viewMatrix[10] * worldPos.z + viewMatrix[14]

            const clipX = projectionMatrix[0] * viewX + projectionMatrix[8] * viewZ
            const clipY = projectionMatrix[5] * viewY + projectionMatrix[9] * viewZ
            const clipW = -viewZ

            if (clipW <= 0) return null

            const ndcX = clipX / clipW
            const ndcY = clipY / clipW

            const viewport = this.view.getViewport()
            const screenX = (ndcX * 0.5 + 0.5) * viewport[2]
            const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * viewport[3]

            return { x: screenX, y: screenY }
        } catch (e) {
            return null
        }
    }

    triggerCollectionFlash(pos, color) {
        this.effectPool?.spawnVisualParticle({
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            duration: 150,
            isCollectionFlash: true,
            maxScale: 1.5,
            color: [color.r, color.g, color.b],
            roughness: 0.0,
        })
    }
}

export function applyGameLogicCollectibles(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLogicCollectibles.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLogicCollectibles.prototype[name];
        }
    }
}
