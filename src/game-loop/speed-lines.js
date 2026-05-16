export class GameLoopSpeedLines {
    // Speed lines configuration
    SPEED_THRESHOLD = 15.0
    SPEED_MAX = 30.0
    speedLinesIntensity = 0.0
    speedLinesCanvas = null
    speedLinesCtx = null
    speedLinesLines = []

    initSpeedLines() {
        this.speedLinesCanvas = document.getElementById('speedlines-canvas')
        if (!this.speedLinesCanvas) return
        
        this.speedLinesCtx = this.speedLinesCanvas.getContext('2d')
        this.resizeSpeedLinesCanvas()
        
        // Initialize random lines for speed effect
        this.speedLinesLines = []
        const numLines = 80
        for (let i = 0; i < numLines; i++) {
            this.speedLinesLines.push(this.createSpeedLine())
        }
        
        // Handle resize
        window.addEventListener('resize', () => this.resizeSpeedLinesCanvas())
    }

    resizeSpeedLinesCanvas() {
        if (!this.speedLinesCanvas) return
        this.speedLinesCanvas.width = window.innerWidth
        this.speedLinesCanvas.height = window.innerHeight
    }

    createSpeedLine() {
        return {
            x: Math.random() - 0.5,
            y: Math.random() - 0.5,
            length: 0.1 + Math.random() * 0.3,
            width: 1 + Math.random() * 3,
            speed: 0.5 + Math.random() * 1.5,
            angle: Math.random() * Math.PI * 2
        }
    }

    updateSpeedLines(speed) {
        // Guard against NaN or undefined speed
        if (!isFinite(speed)) {
            speed = 0
        }
        
        // Calculate target intensity based on speed
        let targetIntensity = 0
        if (speed > this.SPEED_THRESHOLD) {
            targetIntensity = Math.min(1.0, (speed - this.SPEED_THRESHOLD) / (this.SPEED_MAX - this.SPEED_THRESHOLD))
        }
        
        // Smooth fade in/out
        this.speedLinesIntensity = (this.speedLinesIntensity || 0) * 0.9 + targetIntensity * 0.1
        
        // Update canvas opacity
        if (this.speedLinesCanvas) {
            this.speedLinesCanvas.style.opacity = this.speedLinesIntensity.toFixed(3)
        }
    }

    renderSpeedLines() {
        if (!this.speedLinesCtx || !this.speedLinesCanvas || this.speedLinesIntensity <= 0.01) return
        
        // Guard against NaN intensity
        const intensity = Math.max(0, Math.min(1, this.speedLinesIntensity || 0))
        if (!isFinite(intensity)) return
        
        const ctx = this.speedLinesCtx
        const w = this.speedLinesCanvas.width
        const h = this.speedLinesCanvas.height
        const centerX = w / 2
        const centerY = h / 2
        
        // Clear canvas
        ctx.clearRect(0, 0, w, h)
        
        // Set additive blending for streak effect
        ctx.globalCompositeOperation = 'screen'
        const maxRadius = Math.max(w, h) * 0.8
        
        // Draw radial motion blur gradient
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius)
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.0 * intensity})`)
        gradient.addColorStop(0.3, `rgba(255, 255, 255, ${0.05 * intensity})`)
        gradient.addColorStop(0.7, `rgba(200, 220, 255, ${0.15 * intensity})`)
        gradient.addColorStop(1, `rgba(180, 200, 255, ${0.25 * intensity})`)
        
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, w, h)
        
        // Draw speed lines
        const numActiveLines = Math.floor(this.speedLinesLines.length * (0.3 + intensity * 0.7))
        
        for (let i = 0; i < numActiveLines; i++) {
            const line = this.speedLinesLines[i]
            
            // Calculate position from center
            const distance = 0.1 + (i / numActiveLines) * 0.9
            const baseRadius = maxRadius * distance
            
            // Add some movement based on intensity
            const time = Date.now() * 0.001
            const movement = line.speed * intensity * 100 * (time % 1)
            const currentRadius = baseRadius + movement
            
            // Calculate line position
            const angle = line.angle + (i * 0.1 * intensity)
            const x1 = centerX + Math.cos(angle) * currentRadius
            const y1 = centerY + Math.sin(angle) * currentRadius
            
            // Calculate line end point (extending outward)
            const lineLength = line.length * maxRadius * (0.5 + intensity * 0.5)
            const x2 = centerX + Math.cos(angle) * (currentRadius + lineLength)
            const y2 = centerY + Math.sin(angle) * (currentRadius + lineLength)
            
            // Calculate opacity based on distance from center and intensity
            const opacity = (0.3 + intensity * 0.7) * (1 - distance * 0.5)
            
            // Draw the speed line with glow effect
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            
            // Create gradient for line
            const lineGradient = ctx.createLinearGradient(x1, y1, x2, y2)
            lineGradient.addColorStop(0, `rgba(255, 255, 255, 0)`)
            lineGradient.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 0.8})`)
            lineGradient.addColorStop(1, `rgba(200, 220, 255, ${opacity})`)
            
            ctx.strokeStyle = lineGradient
            ctx.lineWidth = line.width * (0.5 + intensity * 0.5)
            ctx.lineCap = 'round'
            ctx.stroke()
            
            // Add glow effect for high intensity
            if (intensity > 0.6) {
                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`
                ctx.lineWidth = line.width * 2 * intensity
                ctx.lineCap = 'round'
                ctx.stroke()
            }
        }
        
        // Add chromatic aberration effect at edges for high speed
        if (intensity > 0.7) {
            const aberrationStrength = (intensity - 0.7) / 0.3
            
            // Draw subtle red/cyan edge tint
            const edgeGradient = ctx.createRadialGradient(centerX, centerY, maxRadius * 0.5, centerX, centerY, maxRadius)
            edgeGradient.addColorStop(0, 'rgba(255, 0, 0, 0)')
            edgeGradient.addColorStop(0.7, `rgba(255, 100, 100, ${0.05 * aberrationStrength})`)
            edgeGradient.addColorStop(1, `rgba(255, 150, 150, ${0.1 * aberrationStrength})`)
            
            ctx.fillStyle = edgeGradient
            ctx.globalCompositeOperation = 'screen'
            ctx.fillRect(0, 0, w, h)
            
            // Cyan offset
            const cyanGradient = ctx.createRadialGradient(centerX + 5 * aberrationStrength, centerY, maxRadius * 0.5, centerX + 5, centerY, maxRadius)
            cyanGradient.addColorStop(0, 'rgba(0, 255, 255, 0)')
            cyanGradient.addColorStop(0.7, `rgba(100, 255, 255, ${0.05 * aberrationStrength})`)
            cyanGradient.addColorStop(1, `rgba(150, 255, 255, ${0.1 * aberrationStrength})`)
            
            ctx.fillStyle = cyanGradient
            ctx.fillRect(0, 0, w, h)
        }
        
        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over'
    }
}

export function applyGameLoopSpeedLines(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopSpeedLines.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopSpeedLines.prototype[name];
        }
    }
}
