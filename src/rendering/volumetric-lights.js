/**
 * volumetric-lights.js
 *
 * Screen-space volumetric light shaft and caustic system.
 * Renders directional god rays and animated caustic patterns on a 2D canvas
 * overlay (same pattern as speed-lines.js) using manual perspective projection.
 *
 * Quality tiers:
 *  low    - disabled (zero cost)
 *  medium - up to 2 shaft sources, no caustics
 *  high   - up to 4 shaft sources + caustics
 *  ultra  - up to 6 shaft sources + caustics (higher opacity)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _normalize(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if (len < 1e-9) return [0, 0, 0]
    return [v[0] / len, v[1] / len, v[2] / len]
}

function _cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ]
}

function _dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

// ---------------------------------------------------------------------------
// VolumetricLightsSystem
// ---------------------------------------------------------------------------

export class VolumetricLightsSystem {
    constructor(quality = 'medium') {
        this.quality = quality
        this.shaftSources = []
        this.causticSources = []
        this.canvas = null
        this.ctx = null
        this.time = 0

        const cfg = _qualityCfg(quality)
        this.maxShafts = cfg.maxShafts
        this.shaftOpacity = cfg.shaftOpacity
        this.causticEnabled = cfg.caustics

        this._resizeHandler = null
        this._initCanvas()
    }

    // ------------------------------------------------------------------
    // Canvas lifecycle
    // ------------------------------------------------------------------

    _initCanvas() {
        if (typeof document === 'undefined') return

        const existing = document.getElementById('volumetric-canvas')
        if (existing) {
            this.canvas = existing
            this.ctx = existing.getContext('2d')
            return
        }

        const canvas = document.createElement('canvas')
        canvas.id = 'volumetric-canvas'
        canvas.style.cssText = [
            'position:absolute', 'top:0', 'left:0',
            'width:100%', 'height:100%',
            'pointer-events:none',
            'mix-blend-mode:screen',
            'z-index:4'
        ].join(';')

        document.body.appendChild(canvas)
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')

        const resize = () => {
            if (!this.canvas) return
            this.canvas.width = window.innerWidth
            this.canvas.height = window.innerHeight
        }
        resize()
        this._resizeHandler = resize
        window.addEventListener('resize', resize)
    }

    /**
     * Remove the canvas overlay from the DOM. Call on engine teardown.
     */
    destroy() {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler)
            this._resizeHandler = null
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas)
        }
        this.canvas = null
        this.ctx = null
    }

    // ------------------------------------------------------------------
    // Source registration (called by createZoneLight, zone setup, etc.)
    // ------------------------------------------------------------------

    /**
     * Register a light as a shaft source.
     * @param {{ pos:{x,y,z}, color:[r,g,b], intensity:number, behavior:string, spread:number }} cfg
     */
    addShaftSource(cfg) {
        this.shaftSources.push({ phase: Math.random() * Math.PI * 2, time: 0, ...cfg })
    }

    /**
     * Register an animated caustic source (floor/surface ripples).
     * @param {{ pos:{x,y,z}, color:[r,g,b], radius:number, behavior:string }} cfg
     */
    addCausticSource(cfg) {
        if (!this.causticEnabled) return
        this.causticSources.push({ phase: Math.random() * Math.PI * 2, time: 0, ...cfg })
    }

    /** Clear all registered sources (called on zone unload). */
    clearSources() {
        this.shaftSources = []
        this.causticSources = []
    }

    setQuality(quality) {
        this.quality = quality
        const cfg = _qualityCfg(quality)
        this.maxShafts = cfg.maxShafts
        this.shaftOpacity = cfg.shaftOpacity
        this.causticEnabled = cfg.caustics
        if (this.canvas) {
            this.canvas.style.display = this.maxShafts === 0 && !this.causticEnabled ? 'none' : 'block'
        }
    }

    // ------------------------------------------------------------------
    // Per-frame update
    // ------------------------------------------------------------------

    /**
     * Render shafts and caustics for this frame.
     *
     * @param {number} deltaTime - Seconds since last frame
     * @param {{ eye:[x,y,z], target:[x,y,z] }|null} cameraState - Stored after camera.lookAt()
     * @param {number} fovDeg   - Vertical FOV in degrees (use activeFov)
     * @param {number} aspect   - Canvas width / height
     */
    update(deltaTime, cameraState, fovDeg = 45, aspect = 1) {
        if (!this.ctx || !this.canvas) return
        if (this.maxShafts === 0 && !this.causticEnabled) return

        this.time += deltaTime

        if (!cameraState) return

        const w = this.canvas.width || window.innerWidth
        const h = this.canvas.height || window.innerHeight

        // Keep canvas in sync with window (cheap check, resize handler handles most)
        if (this.canvas.width !== Math.floor(w) || this.canvas.height !== Math.floor(h)) {
            this.canvas.width = w
            this.canvas.height = h
        }

        const ctx = this.ctx
        ctx.clearRect(0, 0, w, h)

        if (this.shaftSources.length === 0 && this.causticSources.length === 0) return

        ctx.save()
        ctx.globalCompositeOperation = 'screen'

        const sources = this.shaftSources.slice(0, this.maxShafts)
        for (const src of sources) {
            src.time += deltaTime
            const screen = this._projectToScreen(
                src.pos.x, src.pos.y, src.pos.z,
                cameraState, fovDeg, aspect, w, h
            )
            if (!screen) continue

            const anim = _animFactor(src.behavior, src.time + src.phase)
            this._drawShaft(ctx, screen.x, screen.y, w, h, src, anim, this.shaftOpacity)
        }

        if (this.causticEnabled) {
            for (const src of this.causticSources) {
                src.time += deltaTime
                const screen = this._projectToScreen(
                    src.pos.x, src.pos.y, src.pos.z,
                    cameraState, fovDeg, aspect, w, h
                )
                if (!screen) continue
                this._drawCausticPattern(ctx, screen.x, screen.y, src)
            }
        }

        ctx.restore()
    }

    // ------------------------------------------------------------------
    // Projection
    // ------------------------------------------------------------------

    /**
     * Manual perspective projection: world → screen, no matrix access required.
     * Returns null if the point is behind the camera or far off-screen.
     */
    _projectToScreen(wx, wy, wz, cameraState, fovDeg, aspect, w, h) {
        const { eye, target } = cameraState
        const fwd = _normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]])

        // Degenerate check: looking straight up/down, swap world-up reference
        const worldUp = Math.abs(_dot(fwd, [0, 1, 0])) > 0.999 ? [0, 0, -1] : [0, 1, 0]
        const right = _normalize(_cross(fwd, worldUp))
        const up = _cross(right, fwd) // already unit length (no need to re-normalize)

        const toPoint = [wx - eye[0], wy - eye[1], wz - eye[2]]
        const depth = _dot(toPoint, fwd)
        if (depth <= 0.1) return null // behind or too close to camera

        const vRight = _dot(toPoint, right) / depth
        const vUp = _dot(toPoint, up) / depth

        // Map to NDC using field-of-view
        const tanHalfFovV = Math.tan((fovDeg * Math.PI / 180) / 2)
        const tanHalfFovH = tanHalfFovV * aspect

        const ndcX = vRight / tanHalfFovH
        const ndcY = vUp / tanHalfFovV

        // Allow slightly beyond viewport so lights just off-screen still cast shafts
        if (ndcX < -2.5 || ndcX > 2.5 || ndcY < -2.5 || ndcY > 2.5) return null

        const sx = (ndcX * 0.5 + 0.5) * w
        const sy = (1 - (ndcY * 0.5 + 0.5)) * h

        return { x: sx, y: sy, depth }
    }

    // ------------------------------------------------------------------
    // Drawing
    // ------------------------------------------------------------------

    /**
     * Directional god-ray shaft: primary source glow + a beam streak
     * pointing from the light toward the viewport centre (screen-space).
     */
    _drawShaft(ctx, sx, sy, screenW, screenH, src, animFactor, opacity) {
        const [r, g, b] = src.color || [1, 1, 1]
        const ri = Math.round(r * 255)
        const gi = Math.round(g * 255)
        const bi = Math.round(b * 255)

        const baseOpacity = Math.min(opacity * animFactor, 0.65)
        const maxDim = Math.max(screenW, screenH)
        const glowRadius = maxDim * 0.12

        // Primary source bloom
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius)
        glow.addColorStop(0, `rgba(${ri},${gi},${bi},${(baseOpacity * 0.85).toFixed(3)})`)
        glow.addColorStop(0.35, `rgba(${ri},${gi},${bi},${(baseOpacity * 0.40).toFixed(3)})`)
        glow.addColorStop(1, `rgba(${ri},${gi},${bi},0)`)

        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2)
        ctx.fill()

        // Directional shaft: beam toward viewport center
        const cx = screenW * 0.5
        const cy = screenH * 0.5
        const dx = cx - sx
        const dy = cy - sy
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const nx = dx / dist
        const ny = dy / dist

        const shaftLength = maxDim * 0.55
        const steps = 4
        for (let i = 0; i < steps; i++) {
            const t = (i + 0.5) / steps
            const mx = sx + nx * shaftLength * t
            const my = sy + ny * shaftLength * t
            const stepRadius = glowRadius * (0.75 - t * 0.45)
            const stepAlpha = baseOpacity * (0.35 - t * 0.22)

            const grad = ctx.createRadialGradient(mx, my, 0, mx, my, stepRadius)
            grad.addColorStop(0, `rgba(${ri},${gi},${bi},${Math.max(0, stepAlpha).toFixed(3)})`)
            grad.addColorStop(1, `rgba(${ri},${gi},${bi},0)`)

            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(mx, my, stepRadius, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    /**
     * Animated caustic ripples: overlapping sine-displaced rings suggesting
     * light refracted through water or crystal surfaces.
     */
    _drawCausticPattern(ctx, sx, sy, src) {
        const t = src.time + src.phase
        const radius = src.radius || 70
        const [cr, cg, cb] = src.color || [0.3, 0.8, 1.0]
        const ri = Math.round(cr * 255)
        const gi = Math.round(cg * 255)
        const bi = Math.round(cb * 255)

        const numRings = 5
        for (let i = 0; i < numRings; i++) {
            const ringPhase = i * (Math.PI * 2 / numRings)
            const cx = sx + Math.sin(t * 0.65 + ringPhase * 1.3) * radius * 0.28
            const cy = sy + Math.cos(t * 0.48 + ringPhase * 0.95) * radius * 0.22
            const ringR = radius * (0.25 + 0.35 * Math.abs(Math.sin(t * 0.38 + ringPhase)))
            const alpha = 0.035 + 0.025 * Math.sin(t * 1.1 + ringPhase)

            const grad = ctx.createRadialGradient(cx, cy, ringR * 0.25, cx, cy, ringR)
            grad.addColorStop(0, `rgba(${ri},${gi},${bi},0)`)
            grad.addColorStop(0.45, `rgba(${ri},${gi},${bi},${Math.max(0, alpha).toFixed(3)})`)
            grad.addColorStop(1, `rgba(${ri},${gi},${bi},0)`)

            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
            ctx.fill()
        }
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _qualityCfg(quality) {
    const map = {
        low:    { maxShafts: 0, shaftOpacity: 0,    caustics: false },
        medium: { maxShafts: 2, shaftOpacity: 0.25,  caustics: false },
        high:   { maxShafts: 4, shaftOpacity: 0.40,  caustics: true },
        ultra:  { maxShafts: 6, shaftOpacity: 0.55,  caustics: true },
    }
    return map[quality] || map.medium
}

function _animFactor(behavior, t) {
    switch (behavior) {
        case 'lavaFlicker':    return 0.6 + 0.4 * Math.abs(Math.sin(t * 7.0 + Math.sin(t * 4.2)))
        case 'neonPulse':      return 0.7 + 0.3 * Math.sin(t * 2.5)
        case 'biolumSway':     return 0.5 + 0.5 * Math.sin(t * 0.8)
        case 'crystalShimmer': return 0.6 + 0.4 * Math.abs(Math.sin(t * 5.0))
        default:               return 1.0
    }
}

/**
 * Config accessor for quality-tiered volumetric settings.
 * Exported for external use (e.g. documentation, settings UI).
 * @param {string} quality
 * @returns {{ maxShafts:number, shaftOpacity:number, caustics:boolean }}
 */
export function getVolumetricConfig(quality = 'medium') {
    return _qualityCfg(quality)
}
