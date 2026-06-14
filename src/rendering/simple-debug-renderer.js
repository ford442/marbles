const SIMPLE_RENDERER_VALUES = new Set(['simple', 'debug', 'webgl', 'webgl2', 'fallback'])

function setRuntimeRendererGlobals(type, reason = '') {
    window.rendererType = type
    window.usingFilament = type === 'filament'
    window.usingSimpleRenderer = type === 'simple-webgl'
    window.usingWebGL = type === 'simple-webgl' || type === 'filament'
    window.rendererFallbackReason = reason
}

export function getRequestedRendererMode() {
    const params = new URLSearchParams(window.location.search)
    const rendererParam = (params.get('renderer') || '').toLowerCase()
    const storedMode = (window.localStorage?.getItem('marbles.rendererMode') || '').toLowerCase()
    const mode = rendererParam || storedMode

    if (SIMPLE_RENDERER_VALUES.has(mode) || params.has('webgl') || params.has('simpleRenderer') || params.has('debugRenderer')) {
        return { type: 'simple-webgl', explicit: Boolean(rendererParam || params.has('webgl') || params.has('simpleRenderer') || params.has('debugRenderer')) }
    }

    return { type: 'filament', explicit: rendererParam === 'filament' || rendererParam === 'full' }
}

export function persistRendererMode(type) {
    try {
        window.localStorage?.setItem('marbles.rendererMode', type === 'simple-webgl' ? 'simple' : 'filament')
    } catch (_) {
        // localStorage may be unavailable in hardened browser contexts.
    }
}

export function installRendererModeControls(activeType) {
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

    const addButton = (text, type) => {
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
    addButton('Simple', 'simple-webgl')

    document.body.appendChild(panel)
}

class SimpleMaterialInstance {
    constructor() {
        this.color = [0.8, 0.84, 0.9]
    }

    setColor3Parameter(name, _type, color) {
        if (name === 'baseColor' || name === 'emissive') {
            this.color = Array.from(color).slice(0, 3)
        }
    }

    setFloatParameter() {}
}

class SimpleMaterial {
    createInstance() {
        return new SimpleMaterialInstance()
    }
}

class SimpleTransformManager {
    constructor(backend) {
        this.backend = backend
    }

    getInstance(entity) {
        return entity
    }

    setTransform(entity, matrix) {
        this.backend.setTransform(entity, matrix)
    }
}

class SimpleRenderableManager {
    constructor(backend) {
        this.backend = backend
        this.defaultMaterial = new SimpleMaterialInstance()
    }

    getInstance(entity) {
        return entity
    }

    getMaterialInstanceAt(entity) {
        return this.backend.records.get(entity)?.material || this.defaultMaterial
    }

    setCastShadows() {}
    setReceiveShadows() {}
}

class SimpleLightManager {
    getInstance(entity) {
        return entity
    }

    setIntensity() {}
    setColor() {}
    setPosition() {}
    setDirection() {}
}

class SimpleScene {
    constructor(backend) {
        this.backend = backend
    }

    addEntity(entity) {
        this.backend.setEntityVisible(entity, true)
    }

    remove(entity) {
        this.backend.setEntityVisible(entity, false)
    }

    setIndirectLight() {}
    setSkybox() {}
}

class SimpleCamera {
    lookAt(eye, target) {
        this.eye = eye
        this.target = target
    }

    setProjectionFov() {}
}

class SimpleView {
    setCamera() {}
    setScene() {}
    setViewport(viewport) {
        this.viewport = viewport
    }

    setBloomOptions() {}
    setAmbientOcclusionOptions() {}
    setMultiSampleAntiAliasingOptions() {}
    setTemporalAntiAliasingOptions() {}
    setMotionBlurOptions() {}
    setScreenSpaceReflectionsOptions() {}
    setColorGrading() {}
    setVignetteOptions() {}
    setShadowOptions() {}
    setVsmShadowOptions() {}
    setSoftShadowOptions() {}
    setFogOptions() {}
    setDepthOfFieldOptions() {}
}

class SimpleEngine {
    constructor(backend) {
        this.backend = backend
        this.transformManager = new SimpleTransformManager(backend)
        this.renderableManager = new SimpleRenderableManager(backend)
        this.lightManager = new SimpleLightManager()
    }

    createScene() {
        return new SimpleScene(this.backend)
    }

    createSwapChain() {
        return {}
    }

    createRenderer() {
        return {
            beginFrame: () => true,
            render: () => this.backend.render(),
            endFrame: () => {},
            setClearOptions: () => {}
        }
    }

    createCamera() {
        return new SimpleCamera()
    }

    createView() {
        return new SimpleView()
    }

    createMaterial() {
        return new SimpleMaterial()
    }

    getTransformManager() {
        return this.transformManager
    }

    getRenderableManager() {
        return this.renderableManager
    }

    getLightManager() {
        return this.lightManager
    }

    destroyMaterialInstance() {}

    destroyEntity(entity) {
        this.backend.destroyEntity(entity)
    }

    destroySkybox() {}
    destroyIndirectLight() {}
    destroyTexture() {}
    createTextureFromKtx1() { return {} }

    execute() {}
}

class SimpleBuilder {
    constructor(applyBuild) {
        this.applyBuild = applyBuild
        this.record = {}
    }

    boundingBox(value) {
        this.record.boundingBox = value
        return this
    }

    material(_slot, material) {
        this.record.material = material
        return this
    }

    geometry() {
        return this
    }

    receiveShadows() {
        return this
    }

    castShadows() {
        return this
    }

    color(value) {
        this.record.color = value
        return this
    }

    intensity(value) {
        this.record.intensity = value
        return this
    }

    falloff(value) {
        this.record.falloff = value
        return this
    }

    position(value) {
        this.record.position = value
        return this
    }

    direction(value) {
        this.record.direction = value
        return this
    }

    toneMapping() { return this }
    contrast() { return this }
    saturation() { return this }
    vibrance() { return this }
    irradianceSh() { return this }
    intensity(value) {
        this.record.intensity = value
        return this
    }
    reflections() { return this }
    environment() { return this }
    showSun() { return this }
    format() { return this }
    sampler() { return this }
    levels() { return this }
    width() { return this }
    height() { return this }
    depth() { return this }

    build(engine, entity) {
        if (this.applyBuild) this.applyBuild(engine, entity, this.record)
        return {}
    }
}

class SimpleBufferBuilder {
    vertexCount() { return this }
    indexCount() { return this }
    bufferCount() { return this }
    attribute() { return this }
    bufferType() { return this }
    build() {
        return {
            setBufferAt: () => {},
            setBuffer: () => {}
        }
    }
}

function makeFilamentAdapter(backend) {
    let nextEntity = 1
    const entityManager = {
        create: () => nextEntity++,
        destroy: (entity) => backend.destroyEntity(entity)
    }

    return {
        EntityManager: { get: () => entityManager },
        Engine: { create: () => new SimpleEngine(backend) },
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
        'VertexBuffer$AttributeType': { FLOAT3: 0, FLOAT4: 1, FLOAT2: 2 },
        IndexBuffer$IndexType: { USHORT: 0 },
        'IndexBuffer$IndexType': { USHORT: 0 },
        RenderableManager$PrimitiveType: { TRIANGLES: 0 },
        'RenderableManager$PrimitiveType': { TRIANGLES: 0 },
        LightManager$Type: { DIRECTIONAL: 0, POINT: 1 },
        'LightManager$Type': { DIRECTIONAL: 0, POINT: 1 },
        Camera$Fov: { VERTICAL: 0 },
        'Camera$Fov': { VERTICAL: 0 },
        ColorGrading$ToneMapping: { ACES: 0 },
        'ColorGrading$ToneMapping': { ACES: 0 },
        RgbType: { sRGB: 0, LINEAR: 1 },
        'RgbType': { sRGB: 0, LINEAR: 1 }
    }
}

export class SimpleDebugRenderer {
    constructor(canvas, game) {
        this.canvas = canvas
        this.game = game
        this.records = new Map()
        this.transforms = new Map()
        this.lights = new Map()
        this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true })
        if (!this.gl) {
            throw new Error('WebGL2 is not available for the simple debug renderer')
        }
        this._initProgram()
    }

    _initProgram() {
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

    _compileShader(type, source) {
        const gl = this.gl
        const shader = gl.createShader(type)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader) || 'Simple debug shader compile failed')
        }
        return shader
    }

    registerRenderable(entity, record) {
        this.records.set(entity, {
            visible: true,
            material: record.material || new SimpleMaterialInstance(),
            boundingBox: record.boundingBox || null,
            kind: 'renderable'
        })
    }

    registerLight(entity, record) {
        this.lights.set(entity, record)
        this.records.set(entity, {
            visible: true,
            material: { color: record.color || [1, 1, 1] },
            boundingBox: { halfExtent: [0.15, 0.15, 0.15] },
            kind: 'light'
        })
    }

    setEntityVisible(entity, visible) {
        const record = this.records.get(entity)
        if (record) record.visible = visible
    }

    setTransform(entity, matrix) {
        this.transforms.set(entity, Array.from(matrix))
    }

    destroyEntity(entity) {
        this.records.delete(entity)
        this.transforms.delete(entity)
        this.lights.delete(entity)
    }

    render() {
        this._resize()
        const gl = this.gl
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clearColor(0.035, 0.045, 0.06, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        const vertices = []
        const colors = []
        const target = this._target()
        const viewScale = 34
        this._addGrid(vertices, colors, target, viewScale)

        const marbleEntities = new Set((this.game.marbles || []).map(m => m.entity))
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

    _resize() {
        const width = window.innerWidth
        const height = window.innerHeight
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width
            this.canvas.height = height
        }
    }

    _target() {
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

    _project(x, z, target, viewScale) {
        const aspect = this.canvas.width / Math.max(1, this.canvas.height)
        return [
            (x - target.x) / viewScale / aspect,
            -(z - target.z) / viewScale
        ]
    }

    _addTriangle(vertices, colors, points, color) {
        for (const point of points) {
            vertices.push(point[0], point[1])
            colors.push(color[0], color[1], color[2])
        }
    }

    _addQuad(vertices, colors, minX, minZ, maxX, maxZ, color, target, viewScale) {
        const a = this._project(minX, minZ, target, viewScale)
        const b = this._project(maxX, minZ, target, viewScale)
        const c = this._project(maxX, maxZ, target, viewScale)
        const d = this._project(minX, maxZ, target, viewScale)
        this._addTriangle(vertices, colors, [a, b, c], color)
        this._addTriangle(vertices, colors, [a, c, d], color)
    }

    _addBox(vertices, colors, matrix, record, target, viewScale) {
        const x = matrix[12]
        const z = matrix[14]
        const sx = Math.max(0.15, Math.hypot(matrix[0], matrix[1], matrix[2]) * 0.5)
        const sz = Math.max(0.15, Math.hypot(matrix[8], matrix[9], matrix[10]) * 0.5)
        const color = record.material?.color || [0.55, 0.68, 0.78]
        this._addQuad(vertices, colors, x - sx, z - sz, x + sx, z + sz, color, target, viewScale)
    }

    _addCircle(vertices, colors, x, z, radius, color, target, viewScale, segments = 18, ring = false) {
        const center = this._project(x, z, target, viewScale)
        const aspect = this.canvas.width / Math.max(1, this.canvas.height)
        const rx = radius / viewScale / aspect
        const rz = radius / viewScale
        let prev = null
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2
            const next = [center[0] + Math.cos(angle) * rx, center[1] - Math.sin(angle) * rz]
            if (prev) {
                if (ring) {
                    const outerA = prev
                    const outerB = next
                    const innerScale = 0.72
                    const innerA = [center[0] + (outerA[0] - center[0]) * innerScale, center[1] + (outerA[1] - center[1]) * innerScale]
                    const innerB = [center[0] + (outerB[0] - center[0]) * innerScale, center[1] + (outerB[1] - center[1]) * innerScale]
                    this._addTriangle(vertices, colors, [outerA, outerB, innerB], color)
                    this._addTriangle(vertices, colors, [outerA, innerB, innerA], color)
                } else {
                    this._addTriangle(vertices, colors, [center, prev, next], color)
                }
            }
            prev = next
        }
    }

    _addGrid(vertices, colors, target, viewScale) {
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

    _isZeroMatrix(matrix) {
        return Math.abs(matrix[0]) + Math.abs(matrix[5]) + Math.abs(matrix[10]) < 0.0001
    }

    _flush(vertices, colors) {
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

export function installSimpleDebugBackend(game, reason = '') {
    const backend = new SimpleDebugRenderer(game.canvas, game)
    game.simpleDebugRenderer = backend
    game.Filament = makeFilamentAdapter(backend)
    game.engine = game.Filament.Engine.create(game.canvas)
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
