import { getLevel, getOrderedLevelIds } from '../levels/catalog.js';
import { getRenderDimensions } from '../render-resolution.ts';
import {
    computeMedal,
    formatRunTime,
    getMedalThresholds,
    medalEmoji,
} from '../levels/campaign.js';
import { getApiUrl } from '../game/network/cloud-client.ts';
import { recordLevelPlayed } from '../pwa/pwa-state.js';
import { recheckInstallBannerEligibility } from '../pwa/install-prompt.js';
import type { CloudClient, LeaderboardEntry } from '../game/network/cloud-client.ts';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { LevelLoader } from '../game/systems/level-loader.ts';
import type { InitLevelMenu } from '../init/level-menu.ts';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameExtras, FrameState } from '../types/frame-host.ts';
import type { SettingsContext } from '../types/settings.ts';

/** Level-complete modal / leaderboard / confetti fields created on first use. */
export interface GameLogicLevelCompleteScratch {
    /** Ghost id of the current leaderboard leader (shown as "Race leader"). */
    _leaderboardTopGhostId?: string | null;
    /** Leaderboard ghost to race on the next `loadLevel` (read by `InitLevelLoader`). */
    _pendingLeaderboardGhostId?: string | null;
    confettiAnimationId?: number | null;
    confettiTimeout?: ReturnType<typeof setTimeout> | null;
}

/** What `GameLogicLevelComplete` uses on the game. */
export type GameLogicLevelCompleteHost =
    & GameLogicLevelCompleteScratch
    & Pick<EngineContext, 'Filament' | 'view' | 'camera'>
    & Pick<FrameState, 'currentLevel' | 'ghostEntity' | 'score' | 'combo' | 'currentFov'>
    & Pick<FrameExtras, 'ghostReplay'>
    & Pick<InputSystemHost, 'canvas'>
    & Pick<SettingsContext, 'settings'>
    & Pick<LevelLoader, 'loadLevel' | 'createGhostMarble'>
    & Pick<InitLevelMenu, 'returnToMenu'>
    & Pick<GameLogicLevelComplete,
        | 'copyGhostReplay' | 'importGhostReplay' | 'queueLeaderboardGhost' | 'setReplayImportStatus'
        | 'setupReplayShareButtons' | 'refreshLeaderboardSection' | 'hideLevelCompleteModal'
        | 'startConfetti' | 'stopConfetti'>
    & { cloudClient?: CloudClient | null };

/** Set the text of a modal field (skipped when the element is missing). */
function setText(id: string, text: string | null): void {
    const el = document.getElementById(id)
    if (el) el.textContent = text
}

/** One confetti square of `startConfetti`. */
interface ConfettiParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    rotationSpeed: number;
    gravity: number;
    drag: number;
}

export class GameLogicLevelComplete {
    declare game: GameLogicLevelCompleteHost;

    constructor(game: GameLogicLevelCompleteHost) {
        this.game = game;
    }

    setupReplayShareButtons(): void {
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

    queueLeaderboardGhost(): void {
        const ghostId = this.game._leaderboardTopGhostId
        if (!ghostId) return
        this.game._pendingLeaderboardGhostId = ghostId
        this.game.setReplayImportStatus('Leaderboard ghost queued — press Retry to race it.')
    }

    async refreshLeaderboardSection(levelId: string): Promise<void> {
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

        // JSON rows from the leaderboard API.
        const entries = (await this.game.cloudClient?.fetchLeaderboard(levelId) || []) as LeaderboardEntry[]
        if (!entries.length) {
            list.innerHTML = '<li>No global times yet.</li>'
            return
        }

        list.innerHTML = entries.map((e) => (
            `<li>#${e.rank} ${e.displayName} — ${formatRunTime(e.bestTime ?? NaN)}</li>`
        )).join('')

        const top = entries[0]
        if (top?.ghostId && btnRace) {
            this.game._leaderboardTopGhostId = top.ghostId
            btnRace.style.display = 'inline-block'
        }
    }

    setReplayImportStatus(message: string, isError = false): void {
        const el = document.getElementById('replay-import-status')
        if (!el) return
        el.textContent = message
        el.style.color = isError ? '#ff6b6b' : '#7fffd4'
    }

    async copyGhostReplay(): Promise<void> {
        const levelId = this.game.currentLevel
        const blob = levelId ? this.game.ghostReplay?.exportReplay(levelId) : null
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

    importGhostReplay(): void {
        const pasted = window.prompt('Paste a ghost replay string (m3g1:...):')
        if (!pasted?.trim()) return

        try {
            const result = this.game.ghostReplay.importReplay(pasted, this.game.currentLevel ?? undefined)
            this.game.setReplayImportStatus(`Imported ghost for ${result.levelId}.`)
            if (result.levelId === this.game.currentLevel && !this.game.ghostEntity) {
                this.game.createGhostMarble?.()
            }
        } catch (e) {
            this.game.setReplayImportStatus((e instanceof Error && e.message) || 'Invalid replay data.', true)
        }
    }

    showLevelCompleteModal(completionTime: number, newRecord: boolean): void {
        const modal = document.getElementById('level-complete-modal')
        if (!modal) return

        const levelId = this.game.currentLevel
        recordLevelPlayed(levelId)
        recheckInstallBannerEligibility()

        const level = levelId ? getLevel(levelId) : undefined
        const levelName = level?.name || levelId
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
        setText('modal-level-name', levelName)
        setText('modal-completion-time', formattedTime)
        setText('modal-medal', medalEmojiStr)
        setText('modal-base-score', baseScore.toLocaleString())
        setText('modal-time-bonus', `+${timeBonus.toLocaleString()}`)
        setText('modal-combo-bonus', `+${comboBonus.toLocaleString()}`)
        setText('modal-total-score', totalScore.toLocaleString())

        const newRecordBadge = document.getElementById('modal-new-record')
        if (newRecordBadge) {
            newRecordBadge.style.display = newRecord ? 'inline-block' : 'none'
        }

        const replaySection = document.getElementById('replay-share-section')
        if (replaySection) {
            const hasReplay = Boolean(levelId && this.game.ghostReplay?.exportReplay(levelId))
            replaySection.style.display = hasReplay ? 'flex' : 'none'
        }
        this.game.setupReplayShareButtons()
        this.game.setReplayImportStatus('')
        if (levelId) void this.game.refreshLeaderboardSection(levelId)

        // Setup button handlers with smooth transitions
        const btnNext = document.getElementById('btn-next-level')
        const btnRetry = document.getElementById('btn-retry')
        const btnMenu = document.getElementById('btn-main-menu')

        // Get ordered list of level IDs
        const levelIds = getOrderedLevelIds()
        const currentIndex = levelId ? levelIds.indexOf(levelId) : -1
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
                    const retryId = this.game.currentLevel
                    if (typeof this.game.loadLevel === 'function' && retryId) {
                        this.game.loadLevel(retryId)
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

    hideLevelCompleteModal(callback?: () => void): void {
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

    startConfetti(): void {
        const canvas = document.getElementById('confetti-canvas')
        if (!(canvas instanceof HTMLCanvasElement)) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const particles: ConfettiParticle[] = []
        const colors = ['#e94560', '#ffd700', '#00ffff', '#ff00ff', '#00ff88', '#ff8800', '#ffffff']

        // Create particles
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 1) * 15 - 5,
                color: colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff',
                size: Math.random() * 8 + 4,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                gravity: 0.3,
                drag: 0.99
            })
        }

        let animationId: number | null = null
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

    stopConfetti(): void {
        if (this.game.confettiAnimationId) {
            cancelAnimationFrame(this.game.confettiAnimationId)
            this.game.confettiAnimationId = null
        }
        if (this.game.confettiTimeout) {
            clearTimeout(this.game.confettiTimeout)
            this.game.confettiTimeout = null
        }
        const canvas = document.getElementById('confetti-canvas')
        if (canvas instanceof HTMLCanvasElement) {
            const ctx = canvas.getContext('2d')
            ctx?.clearRect(0, 0, canvas.width, canvas.height)
        }
    }

    resize(): void {
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
