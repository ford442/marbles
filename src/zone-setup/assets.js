import { buildMarbleLodMeshes } from '../marble-lod.js';
import { CUBE_VERTICES, CUBE_INDICES } from '../cube-geometry.js';

export class ZoneSetupAssets {
    constructor(game) {
        this.game = game;
    }

    async setupAssets() {
        if (this.game.rendererType === 'simple-webgl') {
            this.game.material = this.game.engine.createMaterial(new Uint8Array())
            this.game.hasProceduralMaterial = false
            this.game.vb = { debugShape: 'box' }
            this.game.ib = { debugShape: 'box-indices' }
            this.game.sphereVb = { debugShape: 'sphere' }
            this.game.sphereIb = { debugShape: 'sphere-indices' }
            this.game.createCueStick()
            this.game.createGrappleLine()
            console.log('[ASSETS] Simple debug renderer using lightweight geometry handles')
            return
        }

        // Load the known-good material by default. The procedural package was
        // compiled by an older matc and can abort newer Filament runtimes during
        // createMaterial(), so keep it as an explicit development opt-in.
        const useProceduralMaterial = new URLSearchParams(window.location.search).get('proceduralMaterial') === '1'
        const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/marbles/';
        const normalizedBase = base.endsWith('/') ? base : `${base}/`;
        const materialFiles = useProceduralMaterial
            ? [`${normalizedBase}baked_procedural.filament`, `${normalizedBase}baked_color.filmat`]
            : [`${normalizedBase}baked_color.filmat`]
        let materialBuffer = null
        let materialFile = null

        for (const file of materialFiles) {
            try {
                console.log(`[ASSETS] Trying to load material: ${file}`)
                const response = await fetch(file)
                if (!response.ok) {
                    console.warn(`[ASSETS] ${file} HTTP ${response.status}, trying next...`)
                    continue
                }
                materialBuffer = await response.arrayBuffer()
                materialFile = file
                console.log(`[ASSETS] Loaded ${materialBuffer.byteLength} bytes from ${file}`)
                break
            } catch (e) {
                console.warn(`[ASSETS] Failed to fetch ${file}:`, e)
            }
        }

        if (!materialBuffer) {
            throw new Error('[ASSETS] Could not load any material file')
        }

        try {
            this.game.material = this.game.engine.createMaterial(new Uint8Array(materialBuffer))
            console.log(`[ASSETS] Material created from ${materialFile}`)
        } catch (e) {
            // If the preferred material fails, try the fallback directly
            const fallbackUrl = `${normalizedBase}baked_color.filmat`;
            if (materialFile !== fallbackUrl) {
                console.warn('[ASSETS] Primary material creation failed, trying baked_color.filmat...', e)
                const resp = await fetch(fallbackUrl)
                const buf = await resp.arrayBuffer()
                this.game.material = this.game.engine.createMaterial(new Uint8Array(buf))
                materialFile = fallbackUrl
                console.log('[ASSETS] Fallback material created')
            } else {
                throw e
            }
        }

        // Track whether the enhanced procedural material is active so we know
        // which material parameters are safe to set on material instances.
        this.game.hasProceduralMaterial = (materialFile === './baked_procedural.filament')
        console.log(`[ASSETS] Procedural material active: ${this.game.hasProceduralMaterial}`)

        const VertexAttribute = this.game.Filament['VertexAttribute']
        const AttributeType = this.game.Filament['VertexBuffer$AttributeType']

        this.game.vb = this.game.Filament.VertexBuffer.Builder()
            .vertexCount(24)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 36)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 36)
            .attribute(VertexAttribute.UV0, 0, AttributeType.FLOAT2, 28, 36)
            .build(this.game.engine)
        this.game.vb.setBufferAt(this.game.engine, 0, CUBE_VERTICES)

        this.game.ib = this.game.Filament.IndexBuffer.Builder()
            .indexCount(36)
            .bufferType(this.game.Filament['IndexBuffer$IndexType'].USHORT)
            .build(this.game.engine)
        this.game.ib.setBuffer(this.game.engine, CUBE_INDICES)

        buildMarbleLodMeshes(this.game, 0.5)
        if (!this.game.sphereVb || !this.game.sphereIb) {
            throw new Error('[ASSETS] Failed to build marble LOD meshes')
        }

        this.game.createCueStick()
        this.game.createGrappleLine()
    }

}
