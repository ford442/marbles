import { quaternionToMat4 } from '../../math.ts';

/**
 * Creation methods for interactive entities, triggers, checkpoints, and pickups.
 */
export const interactiveCreationMethods = {
    createCheckpointZone(offset, size) {
        const sz = size || { x: 10, y: 5, z: 2 };
        const center = { x: offset.x, y: offset.y + sz.y / 2, z: offset.z };
        const q = { x: 0, y: 0, z: 0, w: 1 };
        
        // Create checkpoint visual entity
        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
        matInstance.setFloatParameter('roughness', 0.1);
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [sz.x / 2, sz.y / 2, sz.z / 2] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity);
        
        // Create point light for checkpoint glow
        const lightEntity = this.Filament.EntityManager.get().create();
        this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
            .color([0.0, 0.8, 1.0]) // Cyan/blue color
            .intensity(10000.0) // Base intensity (will increase on activation)
            .position([center.x, center.y, center.z])
            .falloff(10.0) // Light radius
            .build(this.engine, lightEntity);
        this.scene.addEntity(lightEntity);
        
        const tcm = this.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        const mat = quaternionToMat4(center, q);
        mat[0] *= sz.x; mat[1] *= sz.x; mat[2] *= sz.x;
        mat[4] *= sz.y; mat[5] *= sz.y; mat[6] *= sz.y;
        mat[8] *= sz.z; mat[9] *= sz.z; mat[10] *= sz.z;
        tcm.setTransform(inst, mat);
        this.scene.addEntity(entity);
        
        this.checkpoints.push({
            pos: center,
            halfExtents: { x: sz.x / 2, y: sz.y / 2, z: sz.z / 2 },
            entity: entity,
            matInstance: matInstance,
            lightEntity: lightEntity,
            activated: false
        });
    },

    createGoalZone(offset, color) {
        const q = { x: 0, y: 0, z: 0, w: 1 };
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            q,
            { x: 2, y: 0.25, z: 2 },
            color || [1.0, 0.84, 0.0],
            'glass'
        );
        
        // Create enhanced goal visual effects
        this.createGoalEffects(offset, color || [1.0, 0.84, 0.0]);
    },

    createPowerUpZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 10, y: 0.5, z: 40 },
            [0.3, 0.3, 0.35],
            'concrete'
        );

        this.createPowerUp({ x: offset.x - 3, y: offset.y + 1, z: offset.z }, 'speed');
        this.createPowerUp({ x: offset.x + 3, y: offset.y + 1, z: offset.z }, 'speed');
        this.createPowerUp({ x: offset.x, y: offset.y + 1, z: offset.z + 10 }, 'jump');
        this.createPowerUp({ x: offset.x, y: offset.y + 1, z: offset.z + 15 }, 'gravity');

        this.createStaticBox(
            { x: offset.x, y: offset.y + 1, z: offset.z + 20 },
            floorQ,
            { x: 4, y: 1, z: 0.5 },
            [0.8, 0.2, 0.2],
            'metal'
        );
    },

    /**
     * @param {{ x: number, y: number, z: number }} offset
     * @param {{ kind?: string, value?: number }} [collectible]
     */
    createCollectiblePickup(offset, collectible = {}) {
        const kind = collectible.kind || 'coin';
        const value = collectible.value ?? 50;
        const pos = { x: offset.x, y: offset.y + 1, z: offset.z };

        const colors = {
            coin: [1.0, 0.84, 0.0],
            gem: [0.0, 0.8, 1.0],
            star: [1.0, 0.9, 0.2],
        };
        const color = colors[kind] || colors.coin;

        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.15);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        const tcm = this.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        const mat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 });
        const s = 0.5;
        mat[0] *= s; mat[1] *= s; mat[2] *= s;
        mat[4] *= s; mat[5] *= s; mat[6] *= s;
        mat[8] *= s; mat[9] *= s; mat[10] *= s;
        tcm.setTransform(inst, mat);

        if (!this.collectibles) this.collectibles = [];
        this.collectibles.push({
            entity,
            pos,
            baseY: pos.y,
            type: kind,
            value,
        });
    },

    /**
     * @param {{ x: number, y: number, z: number }} offset
     * @param {{ id?: string, radius?: number }} [anchor]
     */
    createGrappleAnchorZone(offset, anchor = {}) {
        const pos = { x: offset.x, y: offset.y + 1.5, z: offset.z };
        const radius = anchor.radius ?? 12;
        const id = anchor.id || `anchor_${this.grappleAnchors?.length ?? 0}`;

        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
        matInstance.setFloatParameter('roughness', 0.2);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.6, 0.6, 0.6] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        const tcm = this.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        const mat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 });
        const s = 0.6;
        mat[0] *= s; mat[1] *= s; mat[2] *= s;
        mat[4] *= s; mat[5] *= s; mat[6] *= s;
        mat[8] *= s; mat[9] *= s; mat[10] *= s;
        tcm.setTransform(inst, mat);

        if (!this.grappleAnchors) this.grappleAnchors = [];
        this.grappleAnchors.push({ id, pos, radius, entity });
    },
};
