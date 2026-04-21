import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createChronoCanyonZone(game, offset) {
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

    // --- High Friction "Sands of Time" Track Segment ---
    {
        const hExtents = { x: 5, y: 0.5, z: 20 };
        const pos = { x: offset.x, y: offset.y - 1, z: offset.z + 25 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);

        // High friction for sand
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(2.0);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'wood'); // Closest to sand crunch

        // Golden/Amber visual
        const { entity } = createVisual(pos, hExtents, [0.8, 0.5, 0.1], 0.8, true);

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

    // --- Kinematic Time-Distorted Platforms ---
    const platformCount = 4;
    for (let i = 0; i < platformCount; i++) {
        const hExtents = { x: 3, y: 0.5, z: 3 };
        const zOffset = offset.z + 55 + (i * 12);
        const startX = offset.x + (i % 2 === 0 ? 5 : -5);

        // Fast speeds to simulate erratic "time distortion"
        const amplitude = 12;
        const speed = 4 + (i * 0.5);

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(startX, offset.y - 2, zOffset);
        const body = game.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setRestitution(1.2); // bouncy
        game.world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'metal');

        const { entity } = createVisual({ x: startX, y: offset.y - 2, z: zOffset }, hExtents, [0.9, 0.7, 0.2], 0.2, true);

        game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: offset.x, // center of oscillation
            amplitude: amplitude,
            initialPos: { x: startX, y: offset.y - 2, z: zOffset },
            speed: speed
        });
    }

    // --- Time Crystal Core (Emissive Light) ---
    const corePos = { x: offset.x, y: offset.y + 10, z: offset.z + 75 };
    const lightEntity = F.EntityManager.get().create();
    F.LightManager.Builder(F['LightManager$Type'].POINT)
        .color([1.0, 0.8, 0.2]) // Amber glow
        .intensity(100000.0)
        .falloff(40.0)
        .position([corePos.x, corePos.y, corePos.z])
        .build(game.engine, lightEntity);
    game.scene.addEntity(lightEntity);
    game.staticEntities.push(lightEntity);

    // Provide a small floating crystal visually where the light is
    {
        const hExtents = { x: 1, y: 2, z: 1 };
        const { entity } = createVisual(corePos, hExtents, [1.0, 0.8, 0.2], 0.1);
        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            corePos.x, corePos.y, corePos.z, 1
        ]);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);

        // Make it a fixed collider so players can bounce off it
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(corePos.x, corePos.y, corePos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setRestitution(2.0);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');
    }

    // --- Exit Platform ---
    {
        const hExtents = { x: 5, y: 0.5, z: 5 };
        const pos = { x: offset.x, y: offset.y - 2, z: offset.z + 110 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'metal');

        const { entity } = createVisual(pos, hExtents, [0.8, 0.8, 0.9]);

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
