// @ts-check
/**
 * Adapts the game object to the `PrimitiveBuildHost` contract that
 * primitives.ts builds against. Without Filament (headless harness) the
 * adapter skips renderables, so only Rapier bodies are created.
 */
import { scaledTransform } from '../game-loop/helpers.ts';
import { ZoneScope } from './primitives.ts';

/** @typedef {import('./primitives.ts').PrimitiveBuildHost} PrimitiveBuildHost */

/**
 * @param {any} game
 * @returns {PrimitiveBuildHost}
 */
export function gamePrimitiveHost(game) {
    if (!game.zoneScope) game.zoneScope = new ZoneScope();
    const canRender = Boolean(game.Filament && game.engine && game.scene && game.vb && game.ib);

    return {
        get zoneScope() { return game.zoneScope; },
        get physicsWorld() { return game.physicsWorld; },
        get world() { return game.world; },
        get physicsBackend() { return game.physicsBackend; },
        get scene() { return game.scene; },
        get engine() { return game.engine; },
        get marbles() { return game.marbles; },
        createPrimitiveRenderable: canRender
            ? (materialInstance, _halfExtents) => {
                const F = game.Filament;
                const entity = F.EntityManager.get().create();
                F.RenderableManager.Builder(1)
                    .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
                    .material(0, materialInstance)
                    .geometry(0, F['RenderableManager$PrimitiveType'].TRIANGLES, game.vb, game.ib)
                    .receiveShadows(true)
                    .castShadows(true)
                    .build(game.engine, entity);
                game.scene.addEntity(entity);
                return entity;
            }
            : undefined,
        setEntityTransform: canRender ? (entity, pose, halfExtents) => setPrimitiveTransform(game, entity, pose, halfExtents) : undefined,
    };
}

/**
 * @param {any} game
 * @param {unknown} entity
 * @param {import('./primitives.ts').Pose} pose
 * @param {{ x: number, y: number, z: number }} halfExtents
 */
export function setPrimitiveTransform(game, entity, pose, halfExtents) {
    if (!entity || !game.engine) return;
    const tcm = game.engine.getTransformManager();
    const mat = scaledTransform(pose.pos, pose.rot, { x: halfExtents.x * 2, y: halfExtents.y * 2, z: halfExtents.z * 2 });
    tcm.setTransform(tcm.getInstance(entity), mat);
}
