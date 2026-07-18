const DEG_TO_RAD = Math.PI / 180

function distanceSq(a, b) {
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    const dz = a[2] - b[2]
    return dx * dx + dy * dy + dz * dz
}

function normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1
    return [v[0] / len, v[1] / len, v[2] / len]
}

function sphereRadiusFromHalfExtent(halfExtent) {
    if (!halfExtent) return 1
    return Math.hypot(halfExtent[0] || 0, halfExtent[1] || 0, halfExtent[2] || 0)
}

const CULL_CONFIG = {
    static: { showDist: 280, hideDist: 330, minCullDist: 70, hidePadDeg: 38, showPadDeg: 55 },
    dynamic: { showDist: 180, hideDist: 230, minCullDist: 55, hidePadDeg: 35, showPadDeg: 50 },
    particle: { showDist: 95, hideDist: 135, minCullDist: 40, hidePadDeg: 32, showPadDeg: 48 },
}

export class CullingManager {
    constructor(game) {
        this.game = game
        const params = new URLSearchParams(window.location.search)
        this.enabled = !(params.get('culling') === '0' || params.has('noCulling') || params.has('noCull'))
        this.states = new Map()
        this.frame = null
        this.stats = this.emptyStats()
        window.cullingStats = this.stats
    }

    emptyStats() {
        return {
            enabled: this.enabled,
            staticHidden: 0,
            staticTotal: 0,
            dynamicHidden: 0,
            dynamicTotal: 0,
            particleHidden: 0,
            particleTotal: 0,
            visibleEntities: 0,
        }
    }

    reset() {
        this.states.clear()
        this.stats = this.emptyStats()
        window.cullingStats = this.stats
    }

    beginFrame() {
        this.stats = this.emptyStats()
        window.cullingStats = this.stats

        if (!this.enabled || this.game.rendererType === 'simple-webgl' || window.usingSimpleRenderer) {
            this.frame = null
            return
        }

        const cameraState = this.game._cameraState
        if (!cameraState?.eye || !cameraState?.target) {
            this.frame = null
            return
        }

        const eye = cameraState.eye
        const target = cameraState.target
        const forward = normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]])
        const fovDeg = this.game.activeFov || this.game.currentFov || 45
        const aspect = (this.game.canvas?.width || window.innerWidth || 1) / (this.game.canvas?.height || window.innerHeight || 1)
        const verticalHalf = (fovDeg * 0.5) * DEG_TO_RAD
        const horizontalHalf = Math.atan(Math.tan(verticalHalf) * aspect)
        const playerPos = this.game.playerMarble?.rigidBody?.translation?.()

        this.frame = {
            eye,
            forward,
            halfAngle: Math.max(verticalHalf, horizontalHalf),
            player: playerPos ? [playerPos.x, playerPos.y, playerPos.z] : null,
        }
    }

    isVisible(key, center, radius = 1, kind = 'dynamic') {
        const config = CULL_CONFIG[kind] || CULL_CONFIG.dynamic
        const state = this.states.get(key) || { hidden: false }
        const visible = this.computeVisibility(state, center, radius, config)
        state.hidden = !visible
        this.states.set(key, state)
        this.record(kind, !visible)
        return visible
    }

    computeVisibility(state, center, radius, config) {
        if (!this.frame || !center) return true

        const eye = this.frame.eye
        const dist = Math.sqrt(distanceSq(center, eye))

        if (this.frame.player && Math.sqrt(distanceSq(center, this.frame.player)) < 55 + radius) {
            return true
        }

        const showDist = config.showDist + radius
        const hideDist = config.hideDist + radius
        if (state.hidden && dist < showDist) return true
        if (!state.hidden && dist > hideDist) return false

        const toCenter = normalize([center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]])
        const dot = this.frame.forward[0] * toCenter[0] + this.frame.forward[1] * toCenter[1] + this.frame.forward[2] * toCenter[2]
        const pad = (state.hidden ? config.showPadDeg : config.hidePadDeg) * DEG_TO_RAD
        const threshold = Math.cos(Math.min(Math.PI - 0.05, this.frame.halfAngle + pad))
        const inViewCone = dot >= threshold

        if (dist < config.minCullDist + radius) return true
        if (state.hidden) return inViewCone || dist < showDist
        return inViewCone || dist < config.minCullDist + radius
    }

    setEntityVisible(entity, visible, key = entity) {
        if (!this.enabled || !this.game.scene || !entity) return
        if (this.game.lightingBudget && !this.game.lightingBudget.isBudgetActive(entity)) {
            visible = false
        }
        const stateKey = `entity:${key}`
        const state = this.states.get(stateKey) || { inScene: true }
        if (state.inScene === visible) return

        if (visible) {
            this.game.scene.addEntity(entity)
        } else {
            this.game.scene.remove(entity)
        }
        state.inScene = visible
        this.states.set(stateKey, state)
    }

    updateStaticBatches() {
        const batches = this.game.staticBatchResources || []
        for (const batch of batches) {
            const bounds = batch.bounds || { center: [0, 0, 0], halfExtent: [1, 1, 1] }
            const visible = this.isVisible(`static-batch:${batch.entity}`, bounds.center, batch.radius || sphereRadiusFromHalfExtent(bounds.halfExtent), 'static')
            this.setEntityVisible(batch.entity, visible, `static-batch:${batch.entity}`)
        }
    }

    record(kind, hidden) {
        if (kind === 'static') {
            this.stats.staticTotal += 1
            if (hidden) this.stats.staticHidden += 1
        } else if (kind === 'particle') {
            this.stats.particleTotal += 1
            if (hidden) this.stats.particleHidden += 1
        } else {
            this.stats.dynamicTotal += 1
            if (hidden) this.stats.dynamicHidden += 1
        }
        this.stats.visibleEntities =
            (this.stats.staticTotal - this.stats.staticHidden) +
            (this.stats.dynamicTotal - this.stats.dynamicHidden) +
            (this.stats.particleTotal - this.stats.particleHidden)
    }
}

export default CullingManager
