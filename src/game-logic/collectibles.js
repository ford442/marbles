import { audio } from '../audio.js';

export class GameLogicCollectibles {
    /**
     * Trigger collection burst effect when a collectible is collected
     * @param {Object} pos - Position {x, y, z} of the collectible
     * @param {number} value - Score value of the collectible
     * @param {string} type - Type of collectible ('coin', 'gem', 'star')
     */
    triggerCollectionEffect(pos, value, type = 'coin') {
        const now = Date.now()
        
        // Define colors based on collectible type
        const colors = {
            coin: { r: 1.0, g: 0.84, b: 0.0 },     // Gold
            gem: { r: 0.0, g: 0.8, b: 1.0 },       // Cyan/Blue
            star: { r: 1.0, g: 0.9, b: 0.2 }       // Bright yellow
        }
        const color = colors[type] || colors.coin
        
        // 1. Create particle burst (25 particles)
        const particleCount = 25
        for (let i = 0; i < particleCount; i++) {
            const particle = this.createCollectionParticle(pos, color, i, particleCount)
            this.visualParticles.push(particle)
        }
        
        // 2. Create flash ring effect
        const ringEntity = this.Filament.EntityManager.get().create()
        const ringMatInstance = this.material.createInstance()
        ringMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [color.r, color.g, color.b])
        ringMatInstance.setFloatParameter('roughness', 0.3)
        
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.05, 0.5] })
            .material(0, ringMatInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, ringEntity)
        
        this.scene.addEntity(ringEntity)
        
        this.visualParticles.push({
            entity: ringEntity,
            matInstance: ringMatInstance,
            spawnTime: now,
            pos: { x: pos.x, y: pos.y, z: pos.z },
            duration: 600,
            isCollectionRing: true,
            startRadius: 0.5,
            maxRadius: 3.0,
            color: color
        })
        
        // 3. Create sparkle rays (8 rays emanating outward)
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2
            const rayEntity = this.Filament.EntityManager.get().create()
            const rayMatInstance = this.material.createInstance()
            rayMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 1.0, 0.8])
            rayMatInstance.setFloatParameter('roughness', 0.1)
            
            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [0.05, 0.05, 0.3] })
                .material(0, rayMatInstance)
                .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
                .receiveShadows(false)
                .castShadows(false)
                .build(this.engine, rayEntity)
            
            this.scene.addEntity(rayEntity)
            
            const speed = 3.0 + Math.random() * 2.0
            this.visualParticles.push({
                entity: rayEntity,
                matInstance: rayMatInstance,
                spawnTime: now,
                pos: { x: pos.x, y: pos.y, z: pos.z },
                vel: {
                    x: Math.cos(angle) * speed,
                    y: 1.0 + Math.random() * 2.0,
                    z: Math.sin(angle) * speed
                },
                duration: 400 + Math.random() * 200,
                isCollectionRay: true,
                angle: angle
            })
        }
        
        // 4. Show floating score popup
        this.showCollectionScorePopup(pos, value)
        
        // 5. Screen flash effect (subtle, localized to position)
        this.triggerCollectionFlash(pos, color)
    }
    
    /**
     * Create a single collection particle
     */
    createCollectionParticle(pos, color, index, total) {
        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        
        // Vary color slightly for visual interest
        const variation = 0.2
        const r = Math.min(1.0, color.r + (Math.random() - 0.5) * variation)
        const g = Math.min(1.0, color.g + (Math.random() - 0.5) * variation)
        const b = Math.min(1.0, color.b + (Math.random() - 0.5) * variation)
        
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
        matInstance.setFloatParameter('roughness', 0.2)
        
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.08, 0.08, 0.08] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, entity)
        
        this.scene.addEntity(entity)
        
        // Calculate burst direction (upward cone)
        const angle = (index / total) * Math.PI * 2
        const spread = 0.5 + Math.random() * 0.5
        const upwardBias = 2.0 + Math.random() * 2.0
        
        return {
            entity: entity,
            matInstance: matInstance,
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
        }
    }
    
    /**
     * Show floating score popup
     */
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
        
        // Project 3D position to screen space
        const screenPos = this.worldToScreen(pos)
        if (screenPos) {
            popup.style.left = screenPos.x + 'px'
            popup.style.top = screenPos.y + 'px'
        } else {
            // Fallback to center
            popup.style.left = '50%'
            popup.style.top = '40%'
        }
        
        uiContainer.appendChild(popup)
        
        // Animate with scale pulse and upward float
        requestAnimationFrame(() => {
            popup.style.transform = 'translate(-50%, -50%) scale(1.2)'
            popup.style.opacity = '1'
            
            setTimeout(() => {
                popup.style.transform = 'translate(-50%, -150%) scale(1.0)'
                popup.style.opacity = '0'
            }, 100)
        })
        
        // Remove after animation
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup)
            }
        }, 900)
    }
    
    /**
     * Convert world position to screen coordinates
     */
    worldToScreen(worldPos) {
        if (!this.camera || !this.view) return null
        
        try {
            // Get camera matrices
            const viewMatrix = this.camera.getViewMatrix()
            const projectionMatrix = this.camera.getProjectionMatrix()
            
            // Transform world to view space
            const viewX = viewMatrix[0] * worldPos.x + viewMatrix[4] * worldPos.y + viewMatrix[8] * worldPos.z + viewMatrix[12]
            const viewY = viewMatrix[1] * worldPos.x + viewMatrix[5] * worldPos.y + viewMatrix[9] * worldPos.z + viewMatrix[13]
            const viewZ = viewMatrix[2] * worldPos.x + viewMatrix[6] * worldPos.y + viewMatrix[10] * worldPos.z + viewMatrix[14]
            
            // Transform view to clip space
            const clipX = projectionMatrix[0] * viewX + projectionMatrix[8] * viewZ
            const clipY = projectionMatrix[5] * viewY + projectionMatrix[9] * viewZ
            const clipW = -viewZ
            
            if (clipW <= 0) return null // Behind camera
            
            // Normalize device coordinates
            const ndcX = clipX / clipW
            const ndcY = clipY / clipW
            
            // Convert to screen coordinates
            const viewport = this.view.getViewport()
            const screenX = (ndcX * 0.5 + 0.5) * viewport[2]
            const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * viewport[3]
            
            return { x: screenX, y: screenY }
        } catch (e) {
            return null
        }
    }
    
    /**
     * Trigger subtle screen flash at collectible position
     */
    triggerCollectionFlash(pos, color) {
        // Create a brief point light at the collection position
        const lightEntity = this.Filament.EntityManager.get().create()
        
        // Create a small emissive sphere for the flash
        const flashEntity = this.Filament.EntityManager.get().create()
        const flashMatInstance = this.material.createInstance()
        flashMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [color.r, color.g, color.b])
        flashMatInstance.setFloatParameter('roughness', 0.0)
        
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.3, 0.3, 0.3] })
            .material(0, flashMatInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, flashEntity)
        
        this.scene.addEntity(flashEntity)
        
        this.visualParticles.push({
            entity: flashEntity,
            matInstance: flashMatInstance,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            duration: 150,
            isCollectionFlash: true,
            maxScale: 1.5
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
