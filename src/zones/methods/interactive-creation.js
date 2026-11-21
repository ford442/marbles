import { quaternionToMat4 } from '../../math.ts';

/**
 * Creation methods for interactive entities, triggers, checkpoints, and pickups.
 */
export class ZoneInteractiveCreation {
    constructor(game) {
        this.game = game;
    }

    createCheckpointZone(offset, size) {
        const sz = size || { x: 10, y: 5, z: 2 };
        const center = { x: offset.x, y: offset.y + sz.y / 2, z: offset.z };
        const q = { x: 0, y: 0, z: 0, w: 1 };
        
        // Create checkpoint visual entity
        const entity = this.game.Filament.EntityManager.get().create();
        const matInstance = this.game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
        matInstance.setFloatParameter('roughness', 0.1);
        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [sz.x / 2, sz.y / 2, sz.z / 2] })
            .material(0, matInstance)
            .geometry(0, this.game.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.game.vb, this.game.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.game.engine, entity);
        
        // Create point light for checkpoint glow
        const lightEntity = this.game.Filament.EntityManager.get().create();
        this.game.Filament.LightManager.Builder(this.game.Filament['LightManager$Type'].POINT)
            .color([0.0, 0.8, 1.0]) // Cyan/blue color
            .intensity(10000.0) // Base intensity (will increase on activation)
            .position([center.x, center.y, center.z])
            .falloff(10.0) // Light radius
            .build(this.game.engine, lightEntity);
        this.game.scene.addEntity(lightEntity);
        
        const tcm = this.game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        const mat = quaternionToMat4(center, q);
        mat[0] *= sz.x; mat[1] *= sz.x; mat[2] *= sz.x;
        mat[4] *= sz.y; mat[5] *= sz.y; mat[6] *= sz.y;
        mat[8] *= sz.z; mat[9] *= sz.z; mat[10] *= sz.z;
        tcm.setTransform(inst, mat);
        this.game.scene.addEntity(entity);
        
        this.game.checkpoints.push({
            pos: center,
            halfExtents: { x: sz.x / 2, y: sz.y / 2, z: sz.z / 2 },
            entity: entity,
            matInstance: matInstance,
            lightEntity: lightEntity,
            activated: false
        });
    }


    createGoalZone(offset, color) {
        const q = { x: 0, y: 0, z: 0, w: 1 };
        this.game.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            q,
            { x: 2, y: 0.25, z: 2 },
            color || [1.0, 0.84, 0.0],
            'glass'
        );
        
        // Create enhanced goal visual effects
        this.game.createGoalEffects(offset, color || [1.0, 0.84, 0.0]);
    }


    createPowerUpZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        this.game.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 10, y: 0.5, z: 40 },
            [0.3, 0.3, 0.35],
            'concrete'
        );

        this.game.createPowerUp({ x: offset.x - 3, y: offset.y + 1, z: offset.z }, 'speed');
        this.game.createPowerUp({ x: offset.x + 3, y: offset.y + 1, z: offset.z }, 'speed');
        this.game.createPowerUp({ x: offset.x, y: offset.y + 1, z: offset.z + 10 }, 'jump');
        this.game.createPowerUp({ x: offset.x, y: offset.y + 1, z: offset.z + 15 }, 'gravity');

        this.game.createStaticBox(
            { x: offset.x, y: offset.y + 1, z: offset.z + 20 },
            floorQ,
            { x: 4, y: 1, z: 0.5 },
            [0.8, 0.2, 0.2],
            'metal'
        );
    }


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

        const entity = this.game.Filament.EntityManager.get().create();
        const matInstance = this.game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.15);

        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.game.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.game.sphereVb, this.game.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.game.engine, entity);

        this.game.scene.addEntity(entity);

        const tcm = this.game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        const mat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 });
        const s = 0.5;
        mat[0] *= s; mat[1] *= s; mat[2] *= s;
        mat[4] *= s; mat[5] *= s; mat[6] *= s;
        mat[8] *= s; mat[9] *= s; mat[10] *= s;
        tcm.setTransform(inst, mat);

        if (!this.game.collectibles) this.game.collectibles = [];
        this.game.collectibles.push({
            entity,
            pos,
            baseY: pos.y,
            type: kind,
            value,
        });
    }


    /**
     * @param {{ x: number, y: number, z: number }} offset
     * @param {{ id?: string, radius?: number }} [anchor]
     */
    createGrappleAnchorZone(offset, anchor = {}) {
        const pos = { x: offset.x, y: offset.y + 1.5, z: offset.z };
        const radius = anchor.radius ?? 12;
        const id = anchor.id || `anchor_${this.game.grappleAnchors?.length ?? 0}`;

        const entity = this.game.Filament.EntityManager.get().create();
        const matInstance = this.game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
        matInstance.setFloatParameter('roughness', 0.2);

        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.6, 0.6, 0.6] })
            .material(0, matInstance)
            .geometry(0, this.game.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.game.sphereVb, this.game.sphereIb)
            .build(this.game.engine, entity);

        this.game.scene.addEntity(entity);

        const tcm = this.game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        const mat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 });
        const s = 0.6;
        mat[0] *= s; mat[1] *= s; mat[2] *= s;
        mat[4] *= s; mat[5] *= s; mat[6] *= s;
        mat[8] *= s; mat[9] *= s; mat[10] *= s;
        tcm.setTransform(inst, mat);

        if (!this.game.grappleAnchors) this.game.grappleAnchors = [];
        this.game.grappleAnchors.push({ id, pos, radius, entity });
    }
}
