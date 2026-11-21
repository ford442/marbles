import {
    getSimpleDebugWebGLContextOptions,
    resolveGraphicsQualityForInit,
    resolveWebGLContextOptions,
} from '../rendering-defaults.js'
import type { EngineContext } from '../types/engine-context.ts'
import type { FrameState } from '../types/frame-host.ts'
import type { GameHost } from '../types/game-host.ts'
import type { SettingsContext } from '../types/settings.ts'

/** The two renderer back ends. */
export type RendererType = 'filament' | 'simple-webgl'

export interface RendererRequest {
    type: RendererType
    /** True when the URL named the renderer explicitly. */
    explicit: boolean
}

/** Entity id handed out by the adapter's EntityManager (game code treats it as opaque). */
type SimpleEntity = unknown

/** Anything with a display colour (material instances, light records). */
interface SimpleColorSource {
    color: readonly number[]
}

/** What a builder accumulates before `build()`. */
interface BuilderRecord {
    boundingBox?: unknown
    material?: SimpleMaterialInstance
    color?: readonly number[]
    intensity?: number
    falloff?: number
    position?: unknown
    direction?: unknown
}

type ApplyBuild = (engine: unknown, entity: SimpleEntity, record: BuilderRecord) => void

/** One drawable entity. */
interface SimpleRecord {
    visible: boolean
    material: SimpleColorSource
    boundingBox: unknown
    kind: 'renderable' | 'light'
}

/** Top-down view centre on the XZ plane. */
interface ViewTarget {
    x: number
    z: number
}

/** A projected 2D point in clip space. */
type Point2 = [number, number]

export interface SimpleRendererFrameStats {
    vertices: number
    triangles: number
    records: number
    marbles: number
}

/**
 * Game members the debug back end reads (`SimpleDebugRenderer`) and the
 * engine / renderer handles `installSimpleDebugBackend` replaces.
 */
export type SimpleDebugHost =
    & Pick<EngineContext, 'Filament' | 'engine' | 'scene' | 'swapChain' | 'renderer' | 'camera' | 'view'>
    & Pick<FrameState, 'marbles' | 'playerMarble' | '_cameraState'>
    & Pick<SettingsContext, 'settings'>
    & Pick<GameHost, 'canvas' | 'rendererType'>
    & {
        webglContextOptions?: Record<string, unknown>
        simpleDebugRenderer?: SimpleDebugRenderer
        /** Human-readable renderer name for logs. */
        rendererModeLabel?: string
    }

declare global {
    interface Window {
        usingFilament?: boolean
        usingWebGL?: boolean
        /** Why the WebGPU probe or Filament fell back ('' when nothing did). */
        rendererFallbackReason?: string
        simpleRendererFrameStats?: SimpleRendererFrameStats
    }
}

/**
 * Element `i`, or NaN when missing — exactly what the untyped arithmetic on
 * `undefined` produced, so short colours / matrices render as before.
 */
function at(values: readonly number[], i: number): number {
    return values[i] ?? NaN
}

const SIMPLE_RENDERER_VALUES = new Set(['simple', 'debug', 'webgl', 'webgl2', 'fallback'])

function setRuntimeRendererGlobals(type: string, reason = ''): void {
    window.rendererType = type
    window.usingFilament = type === 'filament'
    window.usingSimpleRenderer = type === 'simple-webgl'
    window.usingWebGL = type === 'simple-webgl' || type === 'filament'
    window.rendererFallbackReason = reason
}

// The simple WebGL2 debug renderer is a dev / e2e route only
// (`?renderer=simple`, `?webgl`, `?simpleRenderer`, `?debugRenderer`) — the
// player default is always Filament, whether or not the WebGPU boot probe
// passed (see docs/RENDERER_FALLBACK.md). Only the URL selects it: a stored
// `marbles.rendererMode` is ignored so a player can never get stuck in the
// debug view. InitCore also falls back to it when Filament itself fails.
export function getRequestedRendererMode(): RendererRequest {
    const params = new URLSearchParams(window.location.search)
    const rendererParam = (params.get('renderer') || '').toLowerCase()

    if (SIMPLE_RENDERER_VALUES.has(rendererParam) || params.has('webgl') || params.has('simpleRenderer') || params.has('debugRenderer')) {
        console.info('[Renderer] Simple WebGL2 debug renderer requested via URL (dev/e2e only)')
        return { type: 'simple-webgl', explicit: true }
    }

    return { type: 'filament', explicit: rendererParam === 'filament' || rendererParam === 'full' }
}

export function persistRendererMode(type: string): void {
    try {
        window.localStorage?.setItem('marbles.rendererMode', type === 'simple-webgl' ? 'simple' : 'filament')
    } catch (_) {
        // localStorage may be unavailable in hardened browser contexts.
    }
}

export function installRendererModeControls(activeType: string | undefined): void {
    if (document.getElementById('renderer-mode-controls')) return

    const panel = document.createElement('div')
    panel.id = 'renderer-mode-controls'
    panel.style.cssText = [
        'position:fixed',
        'top:10px',
        'right:10px',
        'z-index:1200',
        'display:flex',
        'gap:6px',
        'align-items:center',
        'padding:6px',
        'background:rgba(0,0,0,0.72)',
        'border:1px solid rgba(255,255,255,0.22)',
        'border-radius:4px',
        'font:12px system-ui,sans-serif',
        'color:#fff'
    ].join(';')

    const label = document.createElement('span')
    label.textContent = 'Renderer'
    label.style.marginRight = '2px'
    panel.appendChild(label)

    const addButton = (text: string, type: RendererType) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = text
        button.title = `Switch to ${text} renderer`
        button.style.cssText = [
            'border:1px solid rgba(255,255,255,0.28)',
            'border-radius:4px',
            'padding:4px 7px',
            'font:12px system-ui,sans-serif',
            'color:#fff',
            'cursor:pointer',
            `background:${activeType === type ? 'rgba(0,170,255,0.65)' : 'rgba(255,255,255,0.12)'}`
        ].join(';')
        button.addEventListener('click', () => {
            persistRendererMode(type)
            const url = new URL(window.location.href)
            url.searchParams.set('renderer', type === 'simple-webgl' ? 'simple' : 'filament')
            window.location.href = url.toString()
        })
        panel.appendChild(button)
    }

    addButton('Filament', 'filament')
    // No "Simple" button: the debug renderer is a dev/e2e URL flag, not a
    // player-facing mode. See docs/RENDERER_FALLBACK.md.

    document.body.appendChild(panel)
}

class SimpleMaterialInstance {
    declare color: number[]

    constructor() {
        this.color = [0.8, 0.84, 0.9]
    }

    setColor3Parameter(name: string, _type: unknown, color: ArrayLike<number>): void {
        if (name === 'baseColor' || name === 'emissive') {
            this.color = Array.from(color).slice(0, 3)
        }
    }

    setFloatParameter(): void {}
}

class SimpleMaterial {
    createInstance(): SimpleMaterialInstance {
        return new SimpleMaterialInstance()
    }
}

class SimpleTransformManager {
    declare backend: SimpleDebugRenderer

    constructor(backend: SimpleDebugRenderer) {
        this.backend = backend
    }

    getInstance(entity: SimpleEntity): SimpleEntity {
        return entity
    }

    setTransform(entity: SimpleEntity, matrix: ArrayLike<number>): void {
        this.backend.setTransform(entity, matrix)
    }
}

class SimpleRenderableManager {
    declare backend: SimpleDebugRenderer
    declare defaultMaterial: SimpleMaterialInstance

    constructor(backend: SimpleDebugRenderer) {
        this.backend = backend
        this.defaultMaterial = new SimpleMaterialInstance()
    }

    getInstance(entity: SimpleEntity): SimpleEntity {
        return entity
    }

    getMaterialInstanceAt(entity: SimpleEntity): SimpleColorSource {
        return this.backend.records.get(entity)?.material || this.defaultMaterial
    }

    setCastShadows(): void {}
    setReceiveShadows(): void {}
}

class SimpleLightManager {
    getInstance(entity: SimpleEntity): SimpleEntity {
        return entity
    }

    setIntensity(): void {}
    setColor(): void {}
    setPosition(): void {}
    setDirection(): void {}
}

class SimpleScene {
    declare backend: SimpleDebugRenderer

    constructor(backend: SimpleDebugRenderer) {
        this.backend = backend
    }

    addEntity(entity: SimpleEntity): void {
        this.backend.setEntityVisible(entity, true)
    }

    remove(entity: SimpleEntity): void {
        this.backend.setEntityVisible(entity, false)
    }

    setIndirectLight(): void {}
    setSkybox(): void {}
}

class SimpleCamera {
    declare eye?: unknown
    declare target?: unknown

    lookAt(eye: unknown, target: unknown): void {
        this.eye = eye
        this.target = target
    }

    setProjectionFov(): void {}
}

class SimpleView {
    declare viewport?: unknown

    setCamera(): void {}
    setScene(): void {}
    setViewport(viewport: unknown): void {
        this.viewport = viewport
    }

    setBloomOptions(): void {}
    setAmbientOcclusionOptions(): void {}
    setMultiSampleAntiAliasingOptions(): void {}
    setTemporalAntiAliasingOptions(): void {}
    setMotionBlurOptions(): void {}
    setScreenSpaceReflectionsOptions(): void {}
    setColorGrading(): void {}
    setVignetteOptions(): void {}
    setShadowOptions(): void {}
    setVsmShadowOptions(): void {}
    setSoftShadowOptions(): void {}
    setFogOptions(): void {}
    setDepthOfFieldOptions(): void {}
}

class SimpleEngine {
    declare backend: SimpleDebugRenderer
    declare transformManager: SimpleTransformManager
    declare renderableManager: SimpleRenderableManager
    declare lightManager: SimpleLightManager

    constructor(backend: SimpleDebugRenderer) {
        this.backend = backend
        this.transformManager = new SimpleTransformManager(backend)
        this.renderableManager = new SimpleRenderableManager(backend)
        this.lightManager = new SimpleLightManager()
    }

    createScene(): SimpleScene {
        return new SimpleScene(this.backend)
    }

    createSwapChain(): object {
        return {}
    }

    createRenderer(): {
        beginFrame(): boolean
        render(): void
        endFrame(): void
        setClearOptions(): void
    } {
        return {
            beginFrame: () => true,
            render: () => this.backend.render(),
            endFrame: () => {},
            setClearOptions: () => {}
        }
    }

    createCamera(): SimpleCamera {
        return new SimpleCamera()
    }

    createView(): SimpleView {
        return new SimpleView()
    }

    createMaterial(): SimpleMaterial {
        return new SimpleMaterial()
    }

    getTransformManager(): SimpleTransformManager {
        return this.transformManager
    }

    getRenderableManager(): SimpleRenderableManager {
        return this.renderableManager
    }

    getLightManager(): SimpleLightManager {
        return this.lightManager
    }

    destroyMaterialInstance(): void {}

    destroyEntity(entity: SimpleEntity): void {
        this.backend.destroyEntity(entity)
    }

    destroySkybox(): void {}
    destroyIndirectLight(): void {}
    destroyTexture(): void {}
    createTextureFromKtx1(): object { return {} }

    execute(): void {}
}

class SimpleBuilder {
    declare applyBuild: ApplyBuild | undefined
    declare record: BuilderRecord

    constructor(applyBuild?: ApplyBuild) {
        this.applyBuild = applyBuild
        this.record = {}
    }

    boundingBox(value: unknown): this {
        this.record.boundingBox = value
        return this
    }

    material(_slot: number, material: SimpleMaterialInstance): this {
        this.record.material = material
        return this
    }

    geometry(): this {
        return this
    }

    receiveShadows(): this {
        return this
    }

    castShadows(): this {
        return this
    }

    color(value: readonly number[]): this {
        this.record.color = value
        return this
    }

    // (A second, identical `intensity` used to follow irradianceSh(); the
    // later definition won, so dropping the duplicate changes nothing.)
    intensity(value: number): this {
        this.record.intensity = value
        return this
    }

    falloff(value: number): this {
        this.record.falloff = value
        return this
    }

    position(value: unknown): this {
        this.record.position = value
        return this
    }

    direction(value: unknown): this {
        this.record.direction = value
        return this
    }

    toneMapping(): this { return this }
    contrast(): this { return this }
    saturation(): this { return this }
    vibrance(): this { return this }
    irradianceSh(): this { return this }
    reflections(): this { return this }
    environment(): this { return this }
    showSun(): this { return this }
    format(): this { return this }
    sampler(): this { return this }
    levels(): this { return this }
    width(): this { return this }
    height(): this { return this }
    depth(): this { return this }

    build(engine: unknown, entity?: SimpleEntity): object {
        if (this.applyBuild) this.applyBuild(engine, entity, this.record)
        return {}
    }
}

class SimpleBufferBuilder {
    vertexCount(): this { return this }
    indexCount(): this { return this }
    bufferCount(): this { return this }
    attribute(): this { return this }
    bufferType(): this { return this }
    build(): { setBufferAt(): void; setBuffer(): void } {
        return {
            setBufferAt: () => {},
            setBuffer: () => {}
        }
    }
}

/** A Filament-shaped namespace backed by the 2D debug renderer. */
function makeFilamentAdapter(backend: SimpleDebugRenderer) {
    let nextEntity = 1
    const entityManager = {
        create: () => nextEntity++,
        destroy: (entity: SimpleEntity) => backend.destroyEntity(entity)
    }

    return {
        EntityManager: { get: () => entityManager },
        Engine: { create: (_canvas: unknown, _options: unknown) => new SimpleEngine(backend) },
        RenderableManager: {
            Builder: () => new SimpleBuilder((_engine, entity, record) => backend.registerRenderable(entity, record))
        },
        LightManager: {
            Builder: () => new SimpleBuilder((_engine, entity, record) => backend.registerLight(entity, record))
        },
        VertexBuffer: { Builder: () => new SimpleBufferBuilder() },
        IndexBuffer: { Builder: () => new SimpleBufferBuilder() },
        ColorGrading: { Builder: () => new SimpleBuilder() },
        IndirectLight: { Builder: () => new SimpleBuilder() },
        Skybox: { Builder: () => new SimpleBuilder() },
        Texture: { Builder: () => new SimpleBuilder() },
        TextureSampler: function TextureSampler() {},
        VertexAttribute: { POSITION: 0, TANGENTS: 1, UV0: 2 },
        VertexBuffer$AttributeType: { FLOAT3: 0, FLOAT4: 1, FLOAT2: 2 },
        IndexBuffer$IndexType: { USHORT: 0 },
        RenderableManager$PrimitiveType: { TRIANGLES: 0 },
        LightManager$Type: { DIRECTIONAL: 0, POINT: 1 },
        Camera$Fov: { VERTICAL: 0 },
        ColorGrading$ToneMapping: { ACES: 0 },
        RgbType: { sRGB: 0, LINEAR: 1 },
        // (Each `X$Y` key and RgbType used to appear twice, bare and quoted —
        // the same property with the same value — so one copy is kept.)
    }
}

export class SimpleDebugRenderer {
    declare canvas: HTMLCanvasElement
    declare game: SimpleDebugHost
    declare records: Map<SimpleEntity, SimpleRecord>
    declare transforms: Map<SimpleEntity, number[]>
    declare lights: Map<SimpleEntity, BuilderRecord>
    declare contextOptions: Record<string, unknown>
    declare gl: WebGL2RenderingContext
    declare program: WebGLProgram
    declare positionLoc: number
    declare colorLoc: number
    declare positionBuffer: WebGLBuffer | null
    declare colorBuffer: WebGLBuffer | null
    declare lastFrameStats?: SimpleRendererFrameStats

    constructor(canvas: HTMLCanvasElement, game: SimpleDebugHost, contextOptions: Record<string, unknown> | null = null) {
        this.canvas = canvas
        this.game = game
        this.records = new Map()
        this.transforms = new Map()
        this.lights = new Map()
        this.contextOptions = contextOptions ?? getSimpleDebugWebGLContextOptions(
            resolveGraphicsQualityForInit()
        )
        // DOM boundary: the options object carries standard WebGLContextAttributes.
        const gl = canvas.getContext('webgl2', this.contextOptions as WebGLContextAttributes)
        if (!gl) {
            throw new Error('WebGL2 is not available for the simple debug renderer')
        }
        this.gl = gl
        this._initProgram()
    }

    _initProgram(): void {
        const vertexSource = `#version 300 es
            in vec2 a_position;
            in vec3 a_color;
            out vec3 v_color;
            void main() {
                v_color = a_color;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }`
        const fragmentSource = `#version 300 es
            precision mediump float;
            in vec3 v_color;
            out vec4 outColor;
            void main() {
                outColor = vec4(v_color, 1.0);
            }`
        const gl = this.gl
        const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexSource)
        const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource)
        this.program = gl.createProgram()
        gl.attachShader(this.program, vertexShader)
        gl.attachShader(this.program, fragmentShader)
        gl.linkProgram(this.program)
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(this.program) || 'Simple debug shader link failed')
        }
        this.positionLoc = gl.getAttribLocation(this.program, 'a_position')
        this.colorLoc = gl.getAttribLocation(this.program, 'a_color')
        this.positionBuffer = gl.createBuffer()
        this.colorBuffer = gl.createBuffer()
    }

    _compileShader(type: number, source: string): WebGLShader {
        const gl = this.gl
        const shader = gl.createShader(type)
        if (!shader) {
            // Only on a lost context; shaderSource(null) used to throw here.
            throw new Error('Simple debug shader compile failed')
        }
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader) || 'Simple debug shader compile failed')
        }
        return shader
    }

    registerRenderable(entity: SimpleEntity, record: BuilderRecord): void {
        this.records.set(entity, {
            visible: true,
            material: record.material || new SimpleMaterialInstance(),
            boundingBox: record.boundingBox || null,
            kind: 'renderable'
        })
    }

    registerLight(entity: SimpleEntity, record: BuilderRecord): void {
        this.lights.set(entity, record)
        this.records.set(entity, {
            visible: true,
            material: { color: record.color || [1, 1, 1] },
            boundingBox: { halfExtent: [0.15, 0.15, 0.15] },
            kind: 'light'
        })
    }

    setEntityVisible(entity: SimpleEntity, visible: boolean): void {
        const record = this.records.get(entity)
        if (record) record.visible = visible
    }

    setTransform(entity: SimpleEntity, matrix: ArrayLike<number>): void {
        this.transforms.set(entity, Array.from(matrix))
    }

    destroyEntity(entity: SimpleEntity): void {
        this.records.delete(entity)
        this.transforms.delete(entity)
        this.lights.delete(entity)
    }

    render(): void {
        this._resize()
        const gl = this.gl
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clearColor(0.035, 0.045, 0.06, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        const vertices: number[] = []
        const colors: number[] = []
        const target = this._target()
        const viewScale = 34
        this._addGrid(vertices, colors, target, viewScale)

        const marbleEntities = new Set<SimpleEntity>((this.game.marbles || []).map(m => m.entity))
        for (const [entity, record] of this.records) {
            if (!record.visible || marbleEntities.has(entity) || record.kind === 'light') continue
            const matrix = this.transforms.get(entity)
            if (!matrix || this._isZeroMatrix(matrix)) continue
            this._addBox(vertices, colors, matrix, record, target, viewScale)
        }

        for (const marble of this.game.marbles || []) {
            const pos = marble.rigidBody?.translation?.()
            if (!pos) continue
            const radius = Math.max(0.22, (marble.scale || 1) * 0.45)
            this._addCircle(vertices, colors, pos.x, pos.z, radius, marble.color || [0.8, 0.9, 1.0], target, viewScale)
        }

        if (this.game.playerMarble?.rigidBody) {
            const pos = this.game.playerMarble.rigidBody.translation()
            this._addCircle(vertices, colors, pos.x, pos.z, 0.75, [1.0, 1.0, 0.15], target, viewScale, 20, true)
        }

        this._flush(vertices, colors)
        this.lastFrameStats = {
            vertices: vertices.length / 2,
            triangles: vertices.length / 6,
            records: this.records.size,
            marbles: this.game.marbles?.length || 0
        }
        window.simpleRendererFrameStats = this.lastFrameStats
    }

    _resize(): void {
        const width = window.innerWidth
        const height = window.innerHeight
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width
            this.canvas.height = height
        }
    }

    _target(): ViewTarget {
        if (this.game._cameraState?.target) {
            return { x: this.game._cameraState.target[0], z: this.game._cameraState.target[2] }
        }
        const marble = this.game.playerMarble || this.game.marbles?.[0]
        if (marble?.rigidBody) {
            const t = marble.rigidBody.translation()
            return { x: t.x, z: t.z }
        }
        return { x: 0, z: 0 }
    }

    _project(x: number, z: number, target: ViewTarget, viewScale: number): Point2 {
        const aspect = this.canvas.width / Math.max(1, this.canvas.height)
        return [
            (x - target.x) / viewScale / aspect,
            -(z - target.z) / viewScale
        ]
    }

    _addTriangle(vertices: number[], colors: number[], points: readonly Point2[], color: readonly number[]): void {
        for (const point of points) {
            vertices.push(point[0], point[1])
            colors.push(at(color, 0), at(color, 1), at(color, 2))
        }
    }

    _addQuad(
        vertices: number[], colors: number[], minX: number, minZ: number, maxX: number, maxZ: number,
        color: readonly number[], target: ViewTarget, viewScale: number,
    ): void {
        const a = this._project(minX, minZ, target, viewScale)
        const b = this._project(maxX, minZ, target, viewScale)
        const c = this._project(maxX, maxZ, target, viewScale)
        const d = this._project(minX, maxZ, target, viewScale)
        this._addTriangle(vertices, colors, [a, b, c], color)
        this._addTriangle(vertices, colors, [a, c, d], color)
    }

    _addBox(
        vertices: number[], colors: number[], matrix: readonly number[], record: SimpleRecord,
        target: ViewTarget, viewScale: number,
    ): void {
        const x = at(matrix, 12)
        const z = at(matrix, 14)
        const sx = Math.max(0.15, Math.hypot(at(matrix, 0), at(matrix, 1), at(matrix, 2)) * 0.5)
        const sz = Math.max(0.15, Math.hypot(at(matrix, 8), at(matrix, 9), at(matrix, 10)) * 0.5)
        const color = record.material?.color || [0.55, 0.68, 0.78]
        this._addQuad(vertices, colors, x - sx, z - sz, x + sx, z + sz, color, target, viewScale)
    }

    _addCircle(
        vertices: number[], colors: number[], x: number, z: number, radius: number,
        color: readonly number[], target: ViewTarget, viewScale: number, segments = 18, ring = false,
    ): void {
        const center = this._project(x, z, target, viewScale)
        const aspect = this.canvas.width / Math.max(1, this.canvas.height)
        const rx = radius / viewScale / aspect
        const rz = radius / viewScale
        let prev: Point2 | null = null
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2
            const next: Point2 = [center[0] + Math.cos(angle) * rx, center[1] - Math.sin(angle) * rz]
            if (prev) {
                if (ring) {
                    const outerA = prev
                    const outerB = next
                    const innerScale = 0.72
                    const innerA: Point2 = [center[0] + (outerA[0] - center[0]) * innerScale, center[1] + (outerA[1] - center[1]) * innerScale]
                    const innerB: Point2 = [center[0] + (outerB[0] - center[0]) * innerScale, center[1] + (outerB[1] - center[1]) * innerScale]
                    this._addTriangle(vertices, colors, [outerA, outerB, innerB], color)
                    this._addTriangle(vertices, colors, [outerA, innerB, innerA], color)
                } else {
                    this._addTriangle(vertices, colors, [center, prev, next], color)
                }
            }
            prev = next
        }
    }

    _addGrid(vertices: number[], colors: number[], target: ViewTarget, viewScale: number): void {
        const gridColor = [0.12, 0.16, 0.19]
        const axisX = [0.55, 0.18, 0.18]
        const axisZ = [0.18, 0.36, 0.62]
        const step = 5
        const extent = 80
        const lineWidth = 0.035
        const baseX = Math.round(target.x / step) * step
        const baseZ = Math.round(target.z / step) * step
        for (let x = baseX - extent; x <= baseX + extent; x += step) {
            this._addQuad(vertices, colors, x - lineWidth, baseZ - extent, x + lineWidth, baseZ + extent, Math.abs(x) < 0.001 ? axisX : gridColor, target, viewScale)
        }
        for (let z = baseZ - extent; z <= baseZ + extent; z += step) {
            this._addQuad(vertices, colors, baseX - extent, z - lineWidth, baseX + extent, z + lineWidth, Math.abs(z) < 0.001 ? axisZ : gridColor, target, viewScale)
        }
    }

    _isZeroMatrix(matrix: readonly number[]): boolean {
        return Math.abs(at(matrix, 0)) + Math.abs(at(matrix, 5)) + Math.abs(at(matrix, 10)) < 0.0001
    }

    _flush(vertices: number[], colors: number[]): void {
        if (!vertices.length) return
        const gl = this.gl
        gl.useProgram(this.program)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW)
        gl.enableVertexAttribArray(this.positionLoc)
        gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW)
        gl.enableVertexAttribArray(this.colorLoc)
        gl.vertexAttribPointer(this.colorLoc, 3, gl.FLOAT, false, 0, 0)

        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2)
    }
}

export function installSimpleDebugBackend(game: SimpleDebugHost, reason = ''): SimpleDebugRenderer {
    const glOptions = resolveWebGLContextOptions({
        quality: resolveGraphicsQualityForInit(game.settings?.graphics?.quality),
        forSimpleDebug: true,
    })
    game.webglContextOptions = glOptions
    console.log('[INIT] Simple debug WebGL context options:', glOptions)

    const backend = new SimpleDebugRenderer(game.canvas, game, glOptions)
    game.simpleDebugRenderer = backend
    game.Filament = makeFilamentAdapter(backend)
    game.engine = game.Filament.Engine.create(game.canvas, glOptions)
    game.scene = game.engine.createScene()
    game.swapChain = game.engine.createSwapChain()
    game.renderer = game.engine.createRenderer()

    const cameraEntity = game.Filament.EntityManager.get().create()
    game.camera = game.engine.createCamera(cameraEntity)
    game.view = game.engine.createView()
    game.view.setCamera(game.camera)
    game.view.setScene(game.scene)
    game.view.setViewport([0, 0, game.canvas.width, game.canvas.height])
    game.renderer.setClearOptions({ clearColor: [0.035, 0.045, 0.06, 1.0], clear: true })

    game.rendererType = 'simple-webgl'
    game.rendererModeLabel = 'Simple WebGL2'
    setRuntimeRendererGlobals('simple-webgl', reason)
    return backend
}

export { setRuntimeRendererGlobals }
