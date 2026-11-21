import { scaledTransform } from '../../game-loop/helpers.ts';
import type { PhysicsWorld } from '../../game/systems/physics-world.ts';
import type { EngineContext } from '../../types/engine-context.ts';
import type { FrameState } from '../../types/frame-host.ts';
import type { Vec3 } from '../../types/geometry.ts';
import type { ZonePhysicsMethods } from './physics.ts';
import type { ZoneVisuals } from './visuals.ts';

/** Collectible pickup options from a map zone (`zone.collectible`). */
export interface CollectiblePickupOptions {
    kind?: string;
    value?: number;
}

/** Grapple anchor options from a map zone (`zone.grappleAnchor`). */
export interface GrappleAnchorOptions {
    id?: string;
    radius?: number;
}

/** Game members `ZoneInteractiveCreation` uses. */
export type ZoneInteractiveCreationHost =
    & Pick<EngineContext,
        | 'Filament' | 'engine' | 'scene' | 'material' | 'vb' | 'ib' | 'sphereVb' | 'sphereIb'>
    & Pick<FrameState, 'checkpoints' | 'collectibles' | 'grappleAnchors'>
    & Pick<PhysicsWorld, 'createStaticBox'>
    & Pick<ZonePhysicsMethods, 'createPowerUp'>
    & Pick<ZoneVisuals, 'createGoalEffects'>;

/**
 * Creation methods for interactive entities, triggers, checkpoints, and pickups.
 */
export class ZoneInteractiveCreation {
    declare game: ZoneInteractiveCreationHost;

    constructor(game: ZoneInteractiveCreationHost) {
        this.game = game;
    }

    createCheckpointZone(offset: Vec3, size?: Vec3 | null): void {
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
        const mat = scaledTransform(center, q, sz);
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


    createGoalZone(offset: Vec3, color?: readonly number[] | null): void {
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


    createPowerUpZone(offset: Vec3): void {
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


    createCollectiblePickup(offset: Vec3, collectible: CollectiblePickupOptions = {}): void {
        const kind = collectible.kind || 'coin';
        const value = collectible.value ?? 50;
        const pos = { x: offset.x, y: offset.y + 1, z: offset.z };

        const colors: Record<string, readonly number[]> = {
            coin: [1.0, 0.84, 0.0],
            gem: [0.0, 0.8, 1.0],
            star: [1.0, 0.9, 0.2],
        };
        const color = colors[kind] || colors['coin'];

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
        const s = 0.5;
        const mat = scaledTransform(pos, { x: 0, y: 0, z: 0, w: 1 }, { x: s, y: s, z: s });
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


    createGrappleAnchorZone(offset: Vec3, anchor: GrappleAnchorOptions = {}): void {
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
        const s = 0.6;
        const mat = scaledTransform(pos, { x: 0, y: 0, z: 0, w: 1 }, { x: s, y: s, z: s });
        tcm.setTransform(inst, mat);

        if (!this.game.grappleAnchors) this.game.grappleAnchors = [];
        this.game.grappleAnchors.push({ id, pos, radius, entity });
    }
}
