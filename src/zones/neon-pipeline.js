import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createNeonPipelineZone(game, offset) {
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

        const { entity } = createVisual({ x: offset.x, y: offset.y, z: offset.z }, hExtents, [0.1, 0.1, 0.15]);

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

    // --- Low Friction Ice Track Segment (Neon Cyan/Magenta) ---
    {
        const hExtents = { x: 8, y: 0.5, z: 25 };
        const pos = { x: offset.x, y: offset.y - 2, z: offset.z + 30 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);

        // Low friction for ice
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.01);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');

        // Neon magenta visual
        const { entity } = createVisual(pos, hExtents, [1.0, 0.1, 1.0], 0.0);

        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            pos.x, pos.y, pos.z, 1
        ]);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);

        // Add left wall
        const leftWallPos = { x: pos.x - 7.5, y: pos.y + 2, z: pos.z };
        const wallExtents = { x: 0.5, y: 2, z: 25 };
        const leftWallBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(leftWallPos.x, leftWallPos.y, leftWallPos.z)
            .setRotation(floorQ);
        const leftWallBody = game.world.createRigidBody(leftWallBodyDesc);
        const leftWallColliderDesc = RAPIER.ColliderDesc.cuboid(wallExtents.x, wallExtents.y, wallExtents.z);
        game.world.createCollider(leftWallColliderDesc, leftWallBody);
        game.staticBodies.push(leftWallBody);

        const { entity: leftEntity } = createVisual(leftWallPos, wallExtents, [0.1, 1.0, 1.0]);
        const leftMat = new Float32Array([
            wallExtents.x * 2, 0, 0, 0,
            0, wallExtents.y * 2, 0, 0,
            0, 0, wallExtents.z * 2, 0,
            leftWallPos.x, leftWallPos.y, leftWallPos.z, 1
        ]);
        tcm.setTransform(tcm.getInstance(leftEntity), leftMat);

        // Add right wall
        const rightWallPos = { x: pos.x + 7.5, y: pos.y + 2, z: pos.z };
        const rightWallBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(rightWallPos.x, rightWallPos.y, rightWallPos.z)
            .setRotation(floorQ);
        const rightWallBody = game.world.createRigidBody(rightWallBodyDesc);
        const rightWallColliderDesc = RAPIER.ColliderDesc.cuboid(wallExtents.x, wallExtents.y, wallExtents.z);
        game.world.createCollider(rightWallColliderDesc, rightWallBody);
        game.staticBodies.push(rightWallBody);

        const { entity: rightEntity } = createVisual(rightWallPos, wallExtents, [0.1, 1.0, 1.0]);
        const rightMat = new Float32Array([
            wallExtents.x * 2, 0, 0, 0,
            0, wallExtents.y * 2, 0, 0,
            0, 0, wallExtents.z * 2, 0,
            rightWallPos.x, rightWallPos.y, rightWallPos.z, 1
        ]);
        tcm.setTransform(tcm.getInstance(rightEntity), rightMat);
    }

    // --- Kinematic Sweeping Laser Bars (Cyan) ---
    const platformCount = 3;
    for (let i = 0; i < platformCount; i++) {
        const hExtents = { x: 7, y: 0.25, z: 1 };
        const zOffset = offset.z + 15 + (i * 15);
        const startX = offset.x;
        const amplitude = 3;
        const speed = 3.0 + (i * 0.5);

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(startX, offset.y - 1.5, zOffset);
        const body = game.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.5);
        game.world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual({ x: startX, y: offset.y - 1.5, z: zOffset }, hExtents, [0.1, 1.0, 1.0], 0.2);

        game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: startX,
            amplitude: amplitude,
            initialPos: { x: startX, y: offset.y - 1.5, z: zOffset },
            speed: speed
        });
    }
}
