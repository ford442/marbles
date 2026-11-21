import { audio } from '../../audio.js';
import type { Vec3 } from '../../types/geometry.ts';
import type { EngineContext } from '../../types/engine-context.ts';
import type { FrameState } from '../../types/frame-host.ts';
import type { MovingPlatform } from '../../types/world-objects.ts';

/** Game members `ZonePhysicsMethods` uses. */
export type ZonePhysicsMethodsHost =
    & Pick<EngineContext,
        | 'physicsWorld' | 'Filament' | 'engine' | 'scene' | 'material' | 'vb' | 'ib' | 'levelEffectBudget'>
    & Pick<FrameState, 'movingPlatforms' | 'powerUps'>;

/**
 * Physics-related methods
 * These methods handle physics body creation and management
 */

export class ZonePhysicsMethods {
    declare game: ZonePhysicsMethodsHost;

    constructor(game: ZonePhysicsMethodsHost) {
        this.game = game;
    }

    createKinematicBox(
        pos: Vec3,
        halfExtents: Vec3,
        color: readonly number[],
        type: MovingPlatform['type'],
        center: number,
        amplitude: number,
    ): void {
        const budget = this.game.levelEffectBudget
        if (budget && !budget.canAllocate('kinematicMovers')) {
            return
        }
        if (budget) budget.allocate('kinematicMovers')

        const body = this.game.physicsWorld._createSimBody(
            'kinematic',
            pos,
            { x: 0, y: 0, z: 0, w: 1 },
            { type: 'cuboid', halfExtents, friction: 1.0 },
        );

        audio.registerBodyMaterial(body, 'metal');

        const entity = this.game.Filament.EntityManager.get().create();
        const matInstance = this.game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.3);

        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.game.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.game.vb, this.game.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.game.engine, entity);

        this.game.scene.addEntity(entity);

        this.game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            matInstance,
            halfExtents: halfExtents,
            type: type,
            center: center,
            amplitude: amplitude,
            initialPos: { ...pos },
            speed: 1.5 + Math.random()
        });
    }


    createPowerUp(pos: Vec3, type: string): void {
        const body = this.game.physicsWorld._createSimBody(
            'fixed',
            pos,
            { x: 0, y: 0, z: 0, w: 1 },
            { type: 'sensor_ball', radius: 0.5 },
        );

        const entity = this.game.Filament.EntityManager.get().create();
        const matInstance = this.game.material.createInstance();

        let color = [1, 1, 1];
        if (type === 'speed') color = [0, 1, 1];
        if (type === 'jump') color = [0, 1, 0];
        if (type === 'gravity') color = [1, 1, 0];

        matInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.2);

        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.4, 0.4, 0.4] })
            .material(0, matInstance)
            .geometry(0, this.game.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.game.vb, this.game.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.game.engine, entity);

        this.game.scene.addEntity(entity);

        this.game.powerUps.push({
            rigidBody: body,
            entity: entity,
            matInstance,
            type: type,
            baseY: pos.y,
            rotation: 0,
            pos: pos
        });
    }
}
