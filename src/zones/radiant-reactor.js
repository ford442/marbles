import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createRadiantReactorZone(game, offset) {
    const F = game.Filament;
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Helper to create a basic filament visual entity inline
    const createVisual = (pos, halfExtents, color, roughness = 0.4, bump = false) => {
        const entity = F.EntityManager.get().create();
        const matInstance = game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', roughness);

        if (bump && game.hasProceduralMaterial) {
            matInstance.setFloatParameter('bumpScale', 0.05);
            matInstance.setFloatParameter('bumpFrequency', 30.0);
        }

        F.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, game.vb, game.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(game.engine, entity);

        game.scene.addEntity(entity);
        return { entity, matInstance };
    };

    // --- Entrance Platform ---
    {
        const hExtents = { x: 5, y: 0.5, z: 5 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(offset.x, offset.y, offset.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'concrete');

        const { entity } = createVisual({ x: offset.x, y: offset.y, z: offset.z }, hExtents, [0.2, 0.2, 0.25]);

        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            offset.x, offset.y, offset.z, 1
        ]);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // --- Coolant Pool (Low Friction Icy Floor) ---
    {
        const hExtents = { x: 10, y: 0.5, z: 30 };
        const pos = { x: offset.x, y: offset.y - 2, z: offset.z + 35 };

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.01);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual(pos, hExtents, [0.1, 0.9, 0.2], 0.0); // Radioactive green glass

        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            pos.x, pos.y, pos.z, 1
        ]);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // --- Emissive Central Reactor Core Light ---
    const corePos = { x: offset.x, y: offset.y + 4, z: offset.z + 35 };
    const lightEntity = F.EntityManager.get().create();
    F.LightManager.Builder(F['LightManager$Type'].POINT)
        .color([0.2, 1.0, 0.3]) // Bright green glow
        .intensity(90000.0)
        .falloff(40.0)
        .position([corePos.x, corePos.y, corePos.z])
        .build(game.engine, lightEntity);
    game.scene.addEntity(lightEntity);
    game.staticEntities.push(lightEntity);

    // --- Active Reactor Rods (Kinematic) ---
    for (let i = 0; i < 6; i++) {
        const hExtents = { x: 3, y: 1, z: 1 };
        const zPos = offset.z + 10 + i * 10;
        const yPos = offset.y - 1.5;
        const pos = { x: offset.x, y: yPos, z: zPos };

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(pos.x, pos.y, pos.z);
        const body = game.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setRestitution(0.8);
        game.world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'metal');

        // Emissive-looking rod
        const { entity } = createVisual(pos, hExtents, [0.4, 1.0, 0.4], 0.2, true);

        // Calculate a speed direction toggle
        const direction = i % 2 === 0 ? 1 : -1;

        game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: offset.x,
            amplitude: 8.0,
            initialPos: { ...pos },
            speed: direction * (2.0 + Math.random() * 1.5)
        });
    }

    // --- Exit Platform ---
    {
        const hExtents = { x: 5, y: 0.5, z: 5 };
        const pos = { x: offset.x, y: offset.y - 2, z: offset.z + 70 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'concrete');

        const { entity } = createVisual(pos, hExtents, [0.2, 0.2, 0.25]);

        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            pos.x, pos.y, pos.z, 1
        ]);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }
}
