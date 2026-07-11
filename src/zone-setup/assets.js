import { buildMarbleLodMeshes } from '../marble-lod.js';
import { CUBE_VERTICES, CUBE_INDICES } from '../cube-geometry.js';

export class ZoneSetupAssets {
    async setupAssets() {
        if (this.rendererType === 'simple-webgl') {
            this.material = this.engine.createMaterial(new Uint8Array())
            this.hasProceduralMaterial = false
            this.vb = { debugShape: 'box' }
            this.ib = { debugShape: 'box-indices' }
            this.sphereVb = { debugShape: 'sphere' }
            this.sphereIb = { debugShape: 'sphere-indices' }
            this.createCueStick()
            this.createGrappleLine()
            console.log('[ASSETS] Simple debug renderer using lightweight geometry handles')
            return
        }

        // Load the known-good material by default. The procedural package was
        // compiled by an older matc and can abort newer Filament runtimes during
        // createMaterial(), so keep it as an explicit development opt-in.
        const useProceduralMaterial = new URLSearchParams(window.location.search).get('proceduralMaterial') === '1'
        const materialFiles = useProceduralMaterial
            ? ['./baked_procedural.filament', './baked_color.filmat']
            : ['./baked_color.filmat']
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
            this.material = this.engine.createMaterial(new Uint8Array(materialBuffer))
            console.log(`[ASSETS] Material created from ${materialFile}`)
        } catch (e) {
            // If the preferred material fails, try the fallback directly
            if (materialFile !== './baked_color.filmat') {
                console.warn('[ASSETS] Primary material creation failed, trying baked_color.filmat...', e)
                const resp = await fetch('./baked_color.filmat')
                const buf = await resp.arrayBuffer()
                this.material = this.engine.createMaterial(new Uint8Array(buf))
                materialFile = './baked_color.filmat'
                console.log('[ASSETS] Fallback material created')
            } else {
                throw e
            }
        }

        // Track whether the enhanced procedural material is active so we know
        // which material parameters are safe to set on material instances.
        this.hasProceduralMaterial = (materialFile === './baked_procedural.filament')
        console.log(`[ASSETS] Procedural material active: ${this.hasProceduralMaterial}`)

        const VertexAttribute = this.Filament['VertexAttribute']
        const AttributeType = this.Filament['VertexBuffer$AttributeType']

        this.vb = this.Filament.VertexBuffer.Builder()
            .vertexCount(24)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 36)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 36)
            .attribute(VertexAttribute.UV0, 0, AttributeType.FLOAT2, 28, 36)
            .build(this.engine)
        this.vb.setBufferAt(this.engine, 0, CUBE_VERTICES)

        this.ib = this.Filament.IndexBuffer.Builder()
            .indexCount(36)
            .bufferType(this.Filament['IndexBuffer$IndexType'].USHORT)
            .build(this.engine)
        this.ib.setBuffer(this.engine, CUBE_INDICES)

        buildMarbleLodMeshes(this, 0.5)
        if (!this.sphereVb || !this.sphereIb) {
            throw new Error('[ASSETS] Failed to build marble LOD meshes')
        }

        this.createCueStick()
        this.createGrappleLine()
    }

}

export function applyZoneSetupAssets(targetClass) {
    for (const name of Object.getOwnPropertyNames(ZoneSetupAssets.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ZoneSetupAssets.prototype[name];
        }
    }
}
