import { LEVELS } from '../levels.js';
import { getRenderDimensions } from '../render-resolution.js';

export class GameLogicLevelComplete {
    showLevelCompleteModal(completionTime, newRecord) {
        const modal = document.getElementById('level-complete-modal')
        if (!modal) return

        const level = LEVELS[this.currentLevel]
        const levelName = level?.name || this.currentLevel

        // Format time as MM:SS.ms
        const minutes = Math.floor(completionTime / 60)
        const seconds = Math.floor(completionTime % 60)
        const milliseconds = Math.floor((completionTime % 1) * 10)
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds}`

        // Determine medal based on time
        let medal = ''
        let medalEmoji = ''
        if (completionTime < 30) {
            medal = 'gold'
            medalEmoji = '🥇'
        } else if (completionTime < 60) {
            medal = 'silver'
            medalEmoji = '🥈'
        } else if (completionTime < 120) {
            medal = 'bronze'
            medalEmoji = '🥉'
        } else {
            medalEmoji = '⭐'
        }

        // Calculate score breakdown
        const baseScore = this.score || 0
        const timeBonus = Math.max(0, Math.floor((180 - completionTime) * 10))
        const maxCombo = this.combo || 1
        const comboBonus = (maxCombo - 1) * 50
        const totalScore = baseScore + timeBonus + comboBonus

        // Update modal content
        document.getElementById('modal-level-name').textContent = levelName
        document.getElementById('modal-completion-time').textContent = formattedTime
        document.getElementById('modal-medal').textContent = medalEmoji
        document.getElementById('modal-base-score').textContent = baseScore.toLocaleString()
        document.getElementById('modal-time-bonus').textContent = `+${timeBonus.toLocaleString()}`
        document.getElementById('modal-combo-bonus').textContent = `+${comboBonus.toLocaleString()}`
        document.getElementById('modal-total-score').textContent = totalScore.toLocaleString()

        const newRecordBadge = document.getElementById('modal-new-record')
        if (newRecordBadge) {
            newRecordBadge.style.display = newRecord ? 'inline-block' : 'none'
        }

        // Setup button handlers with smooth transitions
        const btnNext = document.getElementById('btn-next-level')
        const btnRetry = document.getElementById('btn-retry')
        const btnMenu = document.getElementById('btn-main-menu')

        // Get ordered list of level IDs
        const levelIds = Object.keys(LEVELS)
        const currentIndex = levelIds.indexOf(this.currentLevel)
        const nextLevelId = levelIds[currentIndex + 1]

        if (btnNext) {
            btnNext.onclick = () => {
                this.hideLevelCompleteModal(() => {
                    if (nextLevelId && typeof this.loadLevel === 'function') {
                        this.loadLevel(nextLevelId)
                    } else if (typeof this.returnToMenu === 'function') {
                        this.returnToMenu()
                    }
                })
            }
            btnNext.style.display = nextLevelId ? 'block' : 'none'
        }

        if (btnRetry) {
            btnRetry.onclick = () => {
                this.hideLevelCompleteModal(() => {
                    if (typeof this.loadLevel === 'function') {
                        this.loadLevel(this.currentLevel)
                    }
                })
            }
        }

        if (btnMenu) {
            btnMenu.onclick = () => {
                this.hideLevelCompleteModal(() => {
                    if (typeof this.returnToMenu === 'function') {
                        this.returnToMenu()
                    }
                })
            }
        }

        // Blur game view and show modal with animation
        modal.classList.remove('exiting')
        modal.classList.add('active')

        // Trigger confetti after modal appears
        setTimeout(() => {
            this.startConfetti()
        }, 300)
    }

    hideLevelCompleteModal(callback) {
        const modal = document.getElementById('level-complete-modal')
        if (modal) {
            // Add exit animation class
            modal.classList.add('exiting')
            
            // Stop confetti immediately
            this.stopConfetti()
            
            // Wait for exit animation to complete before hiding
            setTimeout(() => {
                modal.classList.remove('active', 'exiting')
                if (callback) callback()
            }, 400)
        } else if (callback) {
            callback()
        }
    }

    startConfetti() {
        const canvas = document.getElementById('confetti-canvas')
        if (!canvas) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const ctx = canvas.getContext('2d')
        const particles = []
        const colors = ['#e94560', '#ffd700', '#00ffff', '#ff00ff', '#00ff88', '#ff8800', '#ffffff']

        // Create particles
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 1) * 15 - 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                gravity: 0.3,
                drag: 0.99
            })
        }

        let animationId = null
        let frameCount = 0

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            frameCount++

            let activeParticles = 0

            for (const p of particles) {
                // Update physics
                p.vy += p.gravity
                p.vx *= p.drag
                p.vy *= p.drag
                p.x += p.vx
                p.y += p.vy
                p.rotation += p.rotationSpeed

                // Draw particle
                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rotation)
                ctx.fillStyle = p.color
                ctx.globalAlpha = Math.max(0, 1 - frameCount / 300) // Fade out over time
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
                ctx.restore()

                if (p.y < canvas.height + 50 && ctx.globalAlpha > 0) {
                    activeParticles++
                }
            }

            // Stop animation after 5 seconds or when all particles are gone
            if (frameCount < 300 && activeParticles > 0) {
                animationId = requestAnimationFrame(animate)
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
            }
        }

        // Store animation ID for cleanup
        this.confettiAnimationId = animationId
        animate()

        // Auto-stop after 5 seconds
        this.confettiTimeout = setTimeout(() => this.stopConfetti(), 5000)
    }

    stopConfetti() {
        if (this.confettiAnimationId) {
            cancelAnimationFrame(this.confettiAnimationId)
            this.confettiAnimationId = null
        }
        if (this.confettiTimeout) {
            clearTimeout(this.confettiTimeout)
            this.confettiTimeout = null
        }
        const canvas = document.getElementById('confetti-canvas')
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
    }

    resize() {
        const { cssWidth, cssHeight, bufferWidth, bufferHeight } = getRenderDimensions(this.settings)
        const width = bufferWidth
        const height = bufferHeight

        this.canvas.style.width = cssWidth + 'px'
        this.canvas.style.height = cssHeight + 'px'
        this.canvas.width = width
        this.canvas.height = height

        console.log(`[RESIZE] Canvas: ${width}x${height} (css ${cssWidth}x${cssHeight})`)

        if (this.view && this.camera) {
            this.view.setViewport([0, 0, width, height])
            const aspect = width / height
            // Use optional chaining for safe $-prefixed enum access across all Filament builds
            const CameraFov = this.Filament?.['Camera$Fov']
            const fovMode = CameraFov ? CameraFov.VERTICAL : 0
            this.camera.setProjectionFov(this.currentFov, aspect, 0.1, 1000.0, fovMode)
            this.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0])
        }
    }
}

export function applyGameLogicLevelComplete(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLogicLevelComplete.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLogicLevelComplete.prototype[name];
        }
    }
}
