import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createNeonPlungeZone(game, offset) {
    const F = game.Filament;
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Sloped rotation for the plunge
    const angleX = -Math.PI / 8; // Slight downward slope
    const slopedQ = {
        x: Math.sin(angleX / 2),
        y: 0,
        z: 0,
        w: Math.cos(angleX / 2)
    };

    // Helper to create a basic filament visual entity inline
    const createVisual = (pos, halfExtents, color, roughness = 0.4, rotation = floorQ) => {
        const entity = F.EntityManager.get().create();
        const matInstance = game.material.createInstance();
        matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', roughness);

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

    // Helper for generating matrix from rotation quat and position
    const buildTransformMatrix = (pos, halfExtents, q) => {
        const x2 = q.x + q.x, y2 = q.y + q.y, z2 = q.z + q.z;
        const xx = q.x * x2, xy = q.x * y2, xz = q.x * z2;
        const yy = q.y * y2, yz = q.y * z2, zz = q.z * z2;
        const wx = q.w * x2, wy = q.w * y2, wz = q.w * z2;

        return new Float32Array([
            (1 - (yy + zz)) * halfExtents.x * 2, (xy + wz) * halfExtents.x * 2, (xz - wy) * halfExtents.x * 2, 0,
            (xy - wz) * halfExtents.y * 2, (1 - (xx + zz)) * halfExtents.y * 2, (yz + wx) * halfExtents.y * 2, 0,
            (xz + wy) * halfExtents.z * 2, (yz - wx) * halfExtents.z * 2, (1 - (xx + yy)) * halfExtents.z * 2, 0,
            pos.x, pos.y, pos.z, 1
        ]);
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

        const { entity } = createVisual({ x: offset.x, y: offset.y, z: offset.z }, hExtents, [0.1, 0.1, 0.15], 0.4, floorQ);

        const mat = buildTransformMatrix({ x: offset.x, y: offset.y, z: offset.z }, hExtents, floorQ);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // --- Low Friction Sloped Ice Track (Neon Pink) ---
    {
        const hExtents = { x: 5, y: 0.5, z: 30 };
        // Adjusted pos for the slope offset
        const pos = { x: offset.x, y: offset.y - 12, z: offset.z + 32 };

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(slopedQ);
        const body = game.world.createRigidBody(bodyDesc);

        // Low friction for ice
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.01);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');

        // Neon pink visual
        const { entity } = createVisual(pos, hExtents, [1.0, 0.1, 0.8], 0.0, slopedQ);

        const mat = buildTransformMatrix(pos, hExtents, slopedQ);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // --- Flat Exit Platform ---
    {
        const hExtents = { x: 5, y: 0.5, z: 15 };
        const pos = { x: offset.x, y: offset.y - 23, z: offset.z + 74 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.01);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual(pos, hExtents, [1.0, 0.1, 0.8], 0.0, floorQ);

        const mat = buildTransformMatrix(pos, hExtents, floorQ);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // --- Kinematic Moving Platforms (Neon Cyan) ---
    const platformCount = 4;
    for (let i = 0; i < platformCount; i++) {
        const hExtents = { x: 4, y: 0.5, z: 4 };
        const zOffset = offset.z + 90 + (i * 10);
        const startX = offset.x;
        const amplitude = 8;
        const speed = 2.5 + (i * 0.5);

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(startX, offset.y - 23, zOffset);
        const body = game.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.5);
        game.world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual({ x: startX, y: offset.y - 23, z: zOffset }, hExtents, [0.1, 1.0, 1.0], 0.2, floorQ);

        game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: startX,
            amplitude: amplitude,
            initialPos: { x: startX, y: offset.y - 23, z: zOffset },
            speed: speed
        });
    }
}
