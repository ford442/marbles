import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createAbyssalTrenchZone(game, offset) {
    const F = game.Filament;
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Helper to create a basic filament visual entity inline
    const createVisual = (pos, halfExtents, color, roughness = 0.4, bump = false, emissive = false) => {
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

        if (emissive) {
            const lightEntity = F.EntityManager.get().create();
            F.LightManager.Builder(F['LightManager$Type'].POINT)
                .color(color) // Match emissive color
                .intensity(80000.0)
                .falloff(15.0)
                .position([pos.x, pos.y, pos.z])
                .build(game.engine, lightEntity);
            game.scene.addEntity(lightEntity);
            game.staticEntities.push(lightEntity);
        }

        return { entity, matInstance, lightEntity: emissive ? lightEntity : null };
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

    // --- Icy Low-Friction Slide ---
    // Slanted downward slide for gaining speed
    {
        const hExtents = { x: 5, y: 0.5, z: 15 };
        const slopeAngle = 0.2; // Radians down
        const pos = { x: offset.x, y: offset.y - 3, z: offset.z + 18 };

        const q = {
            w: Math.cos(slopeAngle * 0.5),
            x: Math.sin(slopeAngle * 0.5),
            y: 0,
            z: 0
        };

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(q);
        const body = game.world.createRigidBody(bodyDesc);

        // Low friction for ice
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.01);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');

        // Dark icy blue visual
        const { entity } = createVisual(pos, hExtents, [0.0, 0.1, 0.3], 0.0);

        // Standard column-major quaternion to matrix
        const x2 = q.x + q.x, y2 = q.y + q.y, z2 = q.z + q.z;
        const xx = q.x * x2, xy = q.x * y2, xz = q.x * z2;
        const yy = q.y * y2, yz = q.y * z2, zz = q.z * z2;
        const wx = q.w * x2, wy = q.w * y2, wz = q.w * z2;

        const m00 = 1 - (yy + zz);
        const m01 = xy - wz;
        const m02 = xz + wy;
        const m10 = xy + wz;
        const m11 = 1 - (xx + zz);
        const m12 = yz - wx;
        const m20 = xz - wy;
        const m21 = yz + wx;
        const m22 = 1 - (xx + yy);

        const scaleX = hExtents.x * 2;
        const scaleY = hExtents.y * 2;
        const scaleZ = hExtents.z * 2;

        const mat = new Float32Array([
            m00 * scaleX, m10 * scaleX, m20 * scaleX, 0,
            m01 * scaleY, m11 * scaleY, m21 * scaleY, 0,
            m02 * scaleZ, m12 * scaleZ, m22 * scaleZ, 0,
            pos.x, pos.y, pos.z, 1
        ]);

        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // --- Gap Jump (implicitly defined by space between 30 and 40) ---

    // --- Bioluminescent Kinematic Moving Platforms ---
    const platformCount = 3;
    for (let i = 0; i < platformCount; i++) {
        const hExtents = { x: 3, y: 0.5, z: 3 };
        const zOffset = offset.z + 45 + (i * 10);
        const startX = offset.x;
        const startY = offset.y - 12; // Lower down since we slid down
        const amplitude = 6;
        const speed = 2.0 + (i * 0.5);

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(startX, startY, zOffset);
        const body = game.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.5);
        game.world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'glass');

        // Bioluminescent glowing green/cyan
        const color = i % 2 === 0 ? [0.1, 1.0, 0.5] : [0.1, 0.5, 1.0];
        const { entity, lightEntity } = createVisual({ x: startX, y: startY, z: zOffset }, hExtents, color, 0.2, false, true);

        game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            lightEntity: lightEntity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: startX,
            amplitude: amplitude,
            initialPos: { x: startX, y: startY, z: zOffset },
            speed: speed
        });
    }

    // --- Exit Platform ---
    {
        const hExtents = { x: 5, y: 0.5, z: 5 };
        const pos = { x: offset.x, y: offset.y - 12, z: offset.z + 75 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'concrete');

        const { entity } = createVisual(pos, hExtents, [0.1, 0.1, 0.15]);

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
