import { getLevel, getOrderedLevelIds } from '../levels/catalog.js';
import { getRenderDimensions } from '../render-resolution.js';
import {
    computeMedal,
    formatRunTime,
    getMedalThresholds,
    medalEmoji,
} from '../levels/campaign.js';
import { getApiUrl } from '../game/network/cloud-client.ts';
import { recordLevelPlayed } from '../pwa/pwa-state.js';
import { recheckInstallBannerEligibility } from '../pwa/install-prompt.js';

export class GameLogicLevelComplete {
    constructor(game) {
        this.game = game;
    }

    setupReplayShareButtons() {
        const btnCopy = document.getElementById('btn-copy-replay')
        const btnImport = document.getElementById('btn-import-replay')
        const btnRaceLeader = document.getElementById('btn-race-leader-ghost')

        if (btnCopy && !btnCopy.dataset.bound) {
            btnCopy.dataset.bound = '1'
            btnCopy.addEventListener('click', () => this.game.copyGhostReplay())
        }

        if (btnImport && !btnImport.dataset.bound) {
            btnImport.dataset.bound = '1'
            btnImport.addEventListener('click', () => this.game.importGhostReplay())
        }

        if (btnRaceLeader && !btnRaceLeader.dataset.bound) {
            btnRaceLeader.dataset.bound = '1'
            btnRaceLeader.addEventListener('click', () => this.game.queueLeaderboardGhost())
        }
    }

    queueLeaderboardGhost() {
        const ghostId = this.game._leaderboardTopGhostId
        if (!ghostId) return
        this.game._pendingLeaderboardGhostId = ghostId
        this.game.setReplayImportStatus('Leaderboard ghost queued — press Retry to race it.')
    }

    async refreshLeaderboardSection(levelId) {
        const section = document.getElementById('leaderboard-section')
        const list = document.getElementById('leaderboard-list')
        const btnRace = document.getElementById('btn-race-leader-ghost')
        if (!section || !list || !getApiUrl()) {
            if (section) section.style.display = 'none'
            return
        }

        section.style.display = 'block'
        list.innerHTML = '<li>Loading leaderboard…</li>'
        if (btnRace) btnRace.style.display = 'none'
        this.game._leaderboardTopGhostId = null

        const entries = await this.game.cloudClient?.fetchLeaderboard(levelId) || []
        if (!entries.length) {
            list.innerHTML = '<li>No global times yet.</li>'
            return
        }

        list.innerHTML = entries.map((e) => (
            `<li>#${e.rank} ${e.displayName} — ${formatRunTime(e.bestTime)}</li>`
        )).join('')

        const top = entries[0]
        if (top?.ghostId && btnRace) {
            this.game._leaderboardTopGhostId = top.ghostId
            btnRace.style.display = 'inline-block'
        }
    }

    setReplayImportStatus(message, isError = false) {
        const el = document.getElementById('replay-import-status')
        if (!el) return
        el.textContent = message
        el.style.color = isError ? '#ff6b6b' : '#7fffd4'
    }

    async copyGhostReplay() {
        const blob = this.game.ghostReplay?.exportReplay(this.game.currentLevel)
        if (!blob) {
            this.game.setReplayImportStatus('No ghost replay saved for this level.', true)
            return
        }

        try {
            await navigator.clipboard.writeText(blob)
            this.game.setReplayImportStatus('Ghost replay copied to clipboard.')
        } catch {
            window.prompt('Copy this ghost replay:', blob)
            this.game.setReplayImportStatus('Replay shown in prompt — copy manually.')
        }
    }

    importGhostReplay() {
        const pasted = window.prompt('Paste a ghost replay string (m3g1:...):')
        if (!pasted?.trim()) return

        try {
            const result = this.game.ghostReplay.importReplay(pasted, this.game.currentLevel)
            this.game.setReplayImportStatus(`Imported ghost for ${result.levelId}.`)
            if (result.levelId === this.game.currentLevel && !this.game.ghostEntity) {
                this.game.createGhostMarble?.()
            }
        } catch (e) {
            this.game.setReplayImportStatus(e?.message || 'Invalid replay data.', true)
        }
    }

    showLevelCompleteModal(completionTime, newRecord) {
        const modal = document.getElementById('level-complete-modal')
        if (!modal) return

        recordLevelPlayed(this.game.currentLevel)
        recheckInstallBannerEligibility()

        const level = getLevel(this.game.currentLevel)
        const levelName = level?.name || this.game.currentLevel
        const thresholds = getMedalThresholds(level)

        const formattedTime = formatRunTime(completionTime)

        const medal = computeMedal(completionTime, thresholds)
        const medalEmojiStr = medalEmoji(medal)

        // Calculate score breakdown
        const baseScore = this.game.score || 0
        const timeBonus = Math.max(0, Math.floor((180 - completionTime) * 10))
        const maxCombo = this.game.combo || 1
        const comboBonus = (maxCombo - 1) * 50
        const totalScore = baseScore + timeBonus + comboBonus

        // Update modal content
        document.getElementById('modal-level-name').textContent = levelName
        document.getElementById('modal-completion-time').textContent = formattedTime
        document.getElementById('modal-medal').textContent = medalEmojiStr
        document.getElementById('modal-base-score').textContent = baseScore.toLocaleString()
        document.getElementById('modal-time-bonus').textContent = `+${timeBonus.toLocaleString()}`
        document.getElementById('modal-combo-bonus').textContent = `+${comboBonus.toLocaleString()}`
        document.getElementById('modal-total-score').textContent = totalScore.toLocaleString()

        const newRecordBadge = document.getElementById('modal-new-record')
        if (newRecordBadge) {
            newRecordBadge.style.display = newRecord ? 'inline-block' : 'none'
        }

        const replaySection = document.getElementById('replay-share-section')
        if (replaySection) {
            const hasReplay = Boolean(this.game.ghostReplay?.exportReplay(this.game.currentLevel))
            replaySection.style.display = hasReplay ? 'flex' : 'none'
        }
        this.game.setupReplayShareButtons()
        this.game.setReplayImportStatus('')
        void this.game.refreshLeaderboardSection(this.game.currentLevel)

        // Setup button handlers with smooth transitions
        const btnNext = document.getElementById('btn-next-level')
        const btnRetry = document.getElementById('btn-retry')
        const btnMenu = document.getElementById('btn-main-menu')

        // Get ordered list of level IDs
        const levelIds = getOrderedLevelIds()
        const currentIndex = levelIds.indexOf(this.game.currentLevel)
        const nextLevelId = levelIds[currentIndex + 1]

        if (btnNext) {
            btnNext.onclick = () => {
                this.game.hideLevelCompleteModal(() => {
                    if (nextLevelId && typeof this.game.loadLevel === 'function') {
                        this.game.loadLevel(nextLevelId)
                    } else if (typeof this.game.returnToMenu === 'function') {
                        this.game.returnToMenu()
                    }
                })
            }
            btnNext.style.display = nextLevelId ? 'block' : 'none'
        }

        if (btnRetry) {
            btnRetry.onclick = () => {
                this.game.hideLevelCompleteModal(() => {
                    if (typeof this.game.loadLevel === 'function') {
                        this.game.loadLevel(this.game.currentLevel)
                    }
                })
            }
        }

        if (btnMenu) {
            btnMenu.onclick = () => {
                this.game.hideLevelCompleteModal(() => {
                    if (typeof this.game.returnToMenu === 'function') {
                        this.game.returnToMenu()
                    }
                })
            }
        }

        // Blur game view and show modal with animation
        modal.classList.remove('exiting')
        modal.classList.add('active')

        // Trigger confetti after modal appears
        setTimeout(() => {
            this.game.startConfetti()
        }, 300)
    }

    hideLevelCompleteModal(callback) {
        const modal = document.getElementById('level-complete-modal')
        if (modal) {
            // Add exit animation class
            modal.classList.add('exiting')
            
            // Stop confetti immediately
            this.game.stopConfetti()
            
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
        this.game.confettiAnimationId = animationId
        animate()

        // Auto-stop after 5 seconds
        this.game.confettiTimeout = setTimeout(() => this.game.stopConfetti(), 5000)
    }

    stopConfetti() {
        if (this.game.confettiAnimationId) {
            cancelAnimationFrame(this.game.confettiAnimationId)
            this.game.confettiAnimationId = null
        }
        if (this.game.confettiTimeout) {
            clearTimeout(this.game.confettiTimeout)
            this.game.confettiTimeout = null
        }
        const canvas = document.getElementById('confetti-canvas')
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
    }

    resize() {
        const { cssWidth, cssHeight, bufferWidth, bufferHeight } = getRenderDimensions(this.game.settings)
        const width = bufferWidth
        const height = bufferHeight

        this.game.canvas.style.width = cssWidth + 'px'
        this.game.canvas.style.height = cssHeight + 'px'
        this.game.canvas.width = width
        this.game.canvas.height = height

        console.log(`[RESIZE] Canvas: ${width}x${height} (css ${cssWidth}x${cssHeight})`)

        if (this.game.view && this.game.camera) {
            this.game.view.setViewport([0, 0, width, height])
            const aspect = width / height
            // Use optional chaining for safe $-prefixed enum access across all Filament builds
            const CameraFov = this.game.Filament?.['Camera$Fov']
            const fovMode = CameraFov ? CameraFov.VERTICAL : 0
            this.game.camera.setProjectionFov(this.game.currentFov, aspect, 0.1, 1000.0, fovMode)
            this.game.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0])
        }
    }
}
