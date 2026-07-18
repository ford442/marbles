import { AutoQualityGovernor } from './auto-quality-governor.js'
import { getPhysicsBackend } from './wasm-bridge.js'
import { getRapierBackendMode } from './game/systems/physics-backend.js'

const PERF_URL_FLAGS = ['fps', 'perf', 'debugPerf']
const FRAME_BUDGET_60HZ = 16.67

function percentile(values, p) {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))
    return sorted[index]
}

function round(value, digits = 2) {
    const scale = 10 ** digits
    return Math.round(value * scale) / scale
}

function safeCount(value) {
    if (!value) return 0
    if (typeof value.length === 'number') return value.length
    if (typeof value.size === 'number') return value.size
    return 0
}

export class PerfMonitor {
    constructor(game) {
        this.game = game
        const params = new URLSearchParams(window.location.search)
        const urlEnabled = PERF_URL_FLAGS.some(flag => params.has(flag))
        const storedEnabled = window.localStorage?.getItem('marbles.perfOverlay') === '1'

        this.enabled = urlEnabled || storedEnabled
        this.loggingEnabled = urlEnabled || params.has('perfLog')
        this.samples = []
        this.maxSamples = 1800
        this.levelLoads = []
        this.lastFrameTime = 0
        this.currentFrame = {}
        this.latestMetrics = {}
        this.lastOverlayUpdate = 0
        this.lastLogTime = 0
        this.currentLevelId = null
        this.frameIndex = 0

        this.createOverlay()
        this.setOverlayVisible(this.enabled)
        this.attachControls()

        if (typeof window !== 'undefined') {
            window.addEventListener('marbles:physics-backend', () => {
                if (this.enabled) this.updateOverlay(performance.now())
            })
        }

        window.perfMonitor = this
    }

    attachControls() {
        window.addEventListener('keydown', (event) => {
            if (event.code !== 'F2') return
            event.preventDefault()
            this.toggle()
        })
    }

    toggle(force) {
        this.enabled = typeof force === 'boolean' ? force : !this.enabled
        try {
            window.localStorage?.setItem('marbles.perfOverlay', this.enabled ? '1' : '0')
        } catch (_) {
            // localStorage can be disabled in automation or private contexts.
        }
        this.setOverlayVisible(this.enabled)
    }

    createOverlay() {
        this.overlay = document.createElement('div')
        this.overlay.id = 'perf-monitor-overlay'
        this.overlay.style.cssText = [
            'position:fixed',
            'left:10px',
            'bottom:10px',
            'z-index:1300',
            'width:270px',
            'padding:8px',
            'background:rgba(0,0,0,0.78)',
            'border:1px solid rgba(255,255,255,0.22)',
            'border-radius:4px',
            'color:#e8f7ff',
            'font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
            'pointer-events:auto'
        ].join(';')

        const header = document.createElement('div')
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px'

        this.titleEl = document.createElement('span')
        this.titleEl.textContent = 'Perf'
        header.appendChild(this.titleEl)

        const closeButton = document.createElement('button')
        closeButton.type = 'button'
        closeButton.textContent = 'Hide'
        closeButton.title = 'Hide FPS overlay (F2 toggles it)'
        closeButton.style.cssText = 'border:1px solid rgba(255,255,255,0.25);border-radius:4px;background:rgba(255,255,255,0.1);color:#fff;font:11px system-ui,sans-serif;padding:2px 6px;cursor:pointer'
        closeButton.addEventListener('click', () => this.toggle(false))
        header.appendChild(closeButton)

        this.textEl = document.createElement('pre')
        this.textEl.style.cssText = 'margin:0 0 6px 0;white-space:pre-wrap;line-height:1.35'

        this.graph = document.createElement('canvas')
        this.graph.width = 254
        this.graph.height = 48
        this.graph.style.cssText = 'display:block;width:254px;height:48px;background:rgba(255,255,255,0.06);border-radius:2px'
        this.graphCtx = this.graph.getContext('2d')

        this.overlay.appendChild(header)
        this.overlay.appendChild(this.textEl)
        this.overlay.appendChild(this.graph)
        document.body.appendChild(this.overlay)
    }

    setOverlayVisible(visible) {
        if (this.overlay) this.overlay.style.display = visible ? 'block' : 'none'
    }

    beginFrame() {
        const now = performance.now()
        const frameMs = this.lastFrameTime > 0 ? now - this.lastFrameTime : FRAME_BUDGET_60HZ
        this.lastFrameTime = now
        this.frameIndex += 1
        this.currentFrame = {
            frameIndex: this.frameIndex,
            startedAt: now,
            frameMs,
            fps: 1000 / Math.max(frameMs, 0.001),
            coreWork: null,
            syncWork: null,
            renderMs: 0,
        }
        this.samples.push(this.currentFrame)
        if (this.samples.length > this.maxSamples) this.samples.shift()
        this.latestMetrics = this.collectMetrics()
        if (this.game.autoQualityGovernor?.isActive()) {
            const p95 = AutoQualityGovernor.computeP95(this.samples)
            this.game.autoQualityGovernor.tick(p95)
            this.latestMetrics = this.collectMetrics()
        }
        this.updateOverlay(now)
        this.maybeLogRuntime(now)
    }

    recordCoreWork(stats) {
        this.currentFrame.coreWork = stats
    }

    recordSyncWork(stats) {
        this.currentFrame.syncWork = stats
    }

    recordRenderTiming(renderMs, rendered = true) {
        this.currentFrame.renderMs = renderMs
        this.currentFrame.rendered = rendered
    }

    resetLevel(levelId) {
        this.currentLevelId = levelId
        this.samples = []
        this.lastFrameTime = 0
        this.frameIndex = 0
        window.perfLevelSummary = null
    }

    recordLevelLoad(levelId, level) {
        this.currentLevelId = levelId
        const metrics = this.collectMetrics()
        const snapshot = {
            levelId,
            levelName: level?.name || levelId,
            timestamp: new Date().toISOString(),
            metrics,
        }
        this.levelLoads.push(snapshot)
        window.perfLevelLoads = this.levelLoads
        console.info('[PERF] level-load', snapshot)
    }

    collectMetrics() {
        const game = this.game
        const particleStats = game.particleSystem?.stats || {}
        const activeParticleCount = (particleStats.activeCount || 0) + safeCount(game.visualParticles)
        const animatedLights = safeCount(game.lightingSystem?.animatedLights)
        const cullingStats = game.cullingManager?.stats || {}
        const lodStats = game.marbleLodManager?.stats || {}
        const poolStats = game.effectPool?.stats || {}
        const gov = game.autoQualityGovernor?.getStatus?.() || {}
        const budgetStats = game.levelEffectBudget?.counts || {}
        const lightBudgetStats = game.lightingBudget?.stats || {}
        const lightBudgetLimits = game.lightingBudget?.getLimits?.() || {}
        const baselineLights = [game.sunLight, game.fillLight, game.backLight].filter(Boolean).length
        const dynamicLights = lightBudgetStats.active ?? 0
        const proxyRenderables =
            safeCount(game.staticEntities) +
            safeCount(game.marbles) +
            safeCount(game.dynamicObjects) +
            safeCount(game.movingPlatforms) +
            safeCount(game.rotatingPlatforms) +
            safeCount(game.temporaryPlatforms) +
            safeCount(game.checkpoints) +
            safeCount(game.collectibles) +
            safeCount(game.powerUps) +
            safeCount(game.visualParticles) +
            safeCount(game.goalEffects)

        return {
            rendererType: window.rendererType || game.rendererType || 'unknown',
            levelId: game.currentLevel,
            staticEntities: safeCount(game.staticEntities),
            marbles: safeCount(game.marbles),
            dynamicObjects: safeCount(game.dynamicObjects),
            movingPlatforms: safeCount(game.movingPlatforms),
            rotatingPlatforms: safeCount(game.rotatingPlatforms),
            temporaryPlatforms: safeCount(game.temporaryPlatforms),
            collectibles: safeCount(game.collectibles),
            powerUps: safeCount(game.powerUps),
            visualParticles: safeCount(game.visualParticles),
            particleSystemActive: particleStats.activeCount || 0,
            particleEmitters: safeCount(game.particleSystem?.ambientEmitters),
            activeParticles: activeParticleCount,
            lights: baselineLights + dynamicLights,
            activeLights: dynamicLights,
            lightBudget: lightBudgetLimits.maxDynamic ?? 0,
            lightBudgetRegistered: lightBudgetStats.registered ?? 0,
            lightBudgetCulled: (lightBudgetStats.culledByBudget ?? 0) + (lightBudgetStats.culledByDistance ?? 0),
            animatedLights,
            staticBatchGroups: game.staticBatchStats?.groups || 0,
            staticBatchedBoxes: game.staticBatchStats?.boxes || 0,
            staticCollapsedEntities: game.staticBatchStats?.collapsedEntities || 0,
            decorativeInstances: game.staticBatchStats?.decorative?.instances || 0,
            cullingEnabled: Boolean(cullingStats.enabled),
            culledStatic: cullingStats.staticHidden || 0,
            culledDynamic: cullingStats.dynamicHidden || 0,
            culledParticles: cullingStats.particleHidden || 0,
            cullingVisibleEntities: cullingStats.visibleEntities || 0,
            lod0: lodStats.lod0 || 0,
            lod1: lodStats.lod1 || 0,
            lod2: lodStats.lod2 || 0,
            effectPoolPooled: poolStats.pooled || 0,
            effectPoolActive: poolStats.active || 0,
            effectPoolAllocFrame: poolStats.allocationsThisFrame || 0,
            physicsBodiesProxy: safeCount(game.staticBodies) + safeCount(game.dynamicBodies),
            renderablesProxy: proxyRenderables,
            drawCallsProxy: proxyRenderables + activeParticleCount,
            autoQualityStep: gov.autoQualityStep ?? 0,
            autoQualityState: gov.state ?? '-',
            autoQualityLabel: gov.lastStepLabel ?? '',
            targetFps: gov.targetFps ?? 60,
            performanceMode: gov.performanceMode ?? 'auto',
            currentQualityBias: gov.currentQualityBias ?? 0,
            levelBudget: budgetStats,
            levelBudgetExceeded: game.levelEffectBudget?.exceeded || {},
            fancyPresetCount: game._fancyPresetCount ?? 0,
            physicsBackend: getPhysicsBackend(),
            rapierBackend: getRapierBackendMode(game),
            physicsStepMs: game.physicsBackend?.lastStepMs ?? 0,
            mainThreadPhysicsWaitMs: game.physicsBackend?.lastWaitMs ?? 0,
        }
    }

    getSummary(sampleWindow = this.samples) {
        const frames = sampleWindow.filter(sample => sample.frameMs > 0)
        const frameTimes = frames.map(sample => sample.frameMs)
        const fpsValues = frames.map(sample => sample.fps)
        const renderTimes = frames.map(sample => sample.renderMs || 0)
        const below55 = frames.filter(sample => sample.fps < 55).length
        const below60 = frames.filter(sample => sample.fps < 60).length
        const avgFrameMs = frameTimes.reduce((sum, value) => sum + value, 0) / Math.max(1, frameTimes.length)
        const avgRenderMs = renderTimes.reduce((sum, value) => sum + value, 0) / Math.max(1, renderTimes.length)

        return {
            levelId: this.currentLevelId || this.game.currentLevel,
            frames: frames.length,
            avgFps: round(1000 / Math.max(avgFrameMs, 0.001), 2),
            minFps: round(fpsValues.length ? Math.min(...fpsValues) : 0, 2),
            p50FrameMs: round(percentile(frameTimes, 0.5), 2),
            p95FrameMs: round(percentile(frameTimes, 0.95), 2),
            maxFrameMs: round(Math.max(...frameTimes, 0), 2),
            avgRenderMs: round(avgRenderMs, 2),
            below55Pct: round((below55 / Math.max(1, frames.length)) * 100, 1),
            below60Pct: round((below60 / Math.max(1, frames.length)) * 100, 1),
            latestMetrics: this.latestMetrics,
            latestCoreWork: frames.at(-1)?.coreWork || null,
            latestSyncWork: frames.at(-1)?.syncWork || null,
            autoQualityStep: this.game.autoQualityGovernor?.autoQualityStep ?? 0,
            targetFps: this.game.autoQualityGovernor?.getTargetFps?.() ?? 60,
            currentQualityBias: this.game.autoQualityGovernor?.getEffectQualityBias?.() ?? 0,
            autoQualityState: this.game.autoQualityGovernor?.state ?? '-',
        }
    }

    getLevelSummary() {
        const summary = this.getSummary()
        window.perfLevelSummary = summary
        return summary
    }

    updateOverlay(now) {
        if (!this.enabled || now - this.lastOverlayUpdate < 250) return
        this.lastOverlayUpdate = now
        const summary = this.getSummary(this.samples.slice(-180))
        const metrics = this.latestMetrics
        const gov = this.game.autoQualityGovernor?.getStatus?.() || {}
        this.textEl.textContent = [
            `${summary.avgFps.toFixed(1)} fps  ${summary.p95FrameMs.toFixed(1)}ms p95`,
            `level: ${metrics.levelId || '-'}`,
            `rapier: ${metrics.rapierBackend || 'main'}  kernels: ${metrics.physicsBackend || 'js-fallback'}`,
            `phys: ${summary.latestSyncWork?.physicsStepMs?.toFixed?.(2) ?? '-'}ms step  wait: ${summary.latestSyncWork?.mainThreadPhysicsWaitMs?.toFixed?.(2) ?? '-'}ms`,
            gov.enabled ? `autoQuality: step ${gov.autoQualityStep}${gov.lastStepLabel ? ` — ${gov.lastStepLabel}` : ''} (${gov.state})` : `perf mode: ${gov.performanceMode || 'locked'}`,
            `entities: ${metrics.staticEntities} static, ${metrics.renderablesProxy} renderable proxy`,
            `batches: ${metrics.staticBatchGroups} groups, ${metrics.staticBatchedBoxes} boxes, ${metrics.decorativeInstances || 0} greebles`,
            `bodies: ${metrics.physicsBodiesProxy}  marbles: ${metrics.marbles}`,
            `particles: ${metrics.activeParticles}  lights: ${metrics.activeLights}/${metrics.lightBudget} dyn (${metrics.lights} total)`,
            `culled: ${metrics.culledStatic} static, ${metrics.culledDynamic} dyn, ${metrics.culledParticles} fx`,
            `lod: ${metrics.lod0} hi, ${metrics.lod1} mid, ${metrics.lod2} low  fancy: ${metrics.fancyPresetCount || 0}/4`,
            `pool: ${metrics.effectPoolActive} active, ${metrics.effectPoolPooled} idle, +${metrics.effectPoolAllocFrame}/f`,
            `transforms: ${summary.latestSyncWork?.estimatedTransformSets || 0} sync + ${summary.latestCoreWork?.estimatedTransformSets || 0} core  mat skip: ${summary.latestSyncWork?.materialUpdatesSkipped ?? 0}`,
            `F2 toggles overlay`
        ].join('\n')
        this.drawGraph(this.samples.slice(-this.graph.width))
    }

    drawGraph(samples) {
        const ctx = this.graphCtx
        if (!ctx) return
        const width = this.graph.width
        const height = this.graph.height
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(0, 0, width, height)
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'
        ctx.beginPath()
        const budgetY = height - Math.min(height, (FRAME_BUDGET_60HZ / 50) * height)
        ctx.moveTo(0, budgetY)
        ctx.lineTo(width, budgetY)
        ctx.stroke()
        ctx.fillStyle = '#49d17d'
        samples.forEach((sample, index) => {
            const x = width - samples.length + index
            const barHeight = Math.min(height, (sample.frameMs / 50) * height)
            ctx.fillStyle = sample.frameMs > FRAME_BUDGET_60HZ ? '#ffb347' : '#49d17d'
            if (sample.frameMs > 24) ctx.fillStyle = '#ff5f5f'
            ctx.fillRect(x, height - barHeight, 1, barHeight)
        })
    }

    maybeLogRuntime(now) {
        if (!this.loggingEnabled || now - this.lastLogTime < 5000 || this.samples.length < 30) return
        this.lastLogTime = now
        console.info('[PERF] runtime', this.getSummary(this.samples.slice(-300)))
    }
}

export default PerfMonitor
