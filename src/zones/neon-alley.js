import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createNeonAlleyZone(game, offset) {
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

    // Helper for visual matrix update
    const updateVisualMatrix = (entity, pos, hExtents, q = floorQ) => {
        // Filament transforms are column-major
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
    };

    // --- Entrance Platform ---
    {
        const hExtents = { x: 5, y: 0.5, z: 5 };
        const pos = { x: offset.x, y: offset.y, z: offset.z };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'metal');

        const { entity } = createVisual(pos, hExtents, [0.1, 0.1, 0.15]);
        updateVisualMatrix(entity, pos, hExtents);
    }

    // --- High-Speed Icy Slide ---
    const slideZ = offset.z + 15;
    const slideLength = 20;
    const slideExtents = { x: 3, y: 0.5, z: slideLength / 2 };

    // Pitch angle to tilt the slide down
    const slidePitch = 0.2; // roughly 11.5 degrees
    const cp = Math.cos(slidePitch * 0.5);
    const sp = Math.sin(slidePitch * 0.5);
    const slideQ = { w: cp, x: sp, y: 0, z: 0 };

    const slidePos = { x: offset.x, y: offset.y - 2, z: slideZ };

    {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(slidePos.x, slidePos.y, slidePos.z)
            .setRotation(slideQ);
        const body = game.world.createRigidBody(bodyDesc);
        // Extremely low friction
        const colliderDesc = RAPIER.ColliderDesc.cuboid(slideExtents.x, slideExtents.y, slideExtents.z).setFriction(0.0);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual(slidePos, slideExtents, [0.0, 0.05, 0.1]); // Dark base
        updateVisualMatrix(entity, slidePos, slideExtents, slideQ);
    }

    // --- Neon Accents on Slide ---
    const accentColors = [
        [0.0, 1.0, 0.5], // Neon Green
        [1.0, 0.0, 0.8], // Neon Pink
        [0.0, 0.8, 1.0]  // Neon Blue
    ];

    for (let i = 0; i < 3; i++) {
        const accentPos = {
            x: offset.x + (i === 1 ? 0 : (i === 0 ? -3.5 : 3.5)),
            y: slidePos.y + 0.5 - (i*0.5),
            z: slideZ - 5 + i * 5
        };
        const lightEntity = F.EntityManager.get().create();
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color(accentColors[i])
            .intensity(50000.0)
            .falloff(10.0)
            .position([accentPos.x, accentPos.y, accentPos.z])
            .build(game.engine, lightEntity);
        game.scene.addEntity(lightEntity);
        game.staticEntities.push(lightEntity);
    }

    // --- Bouncing Static Obstacles ---
    const bounceZ = slideZ + slideLength / 2 + 10;
    const bouncePlatformExtents = { x: 5, y: 0.5, z: 5 };
    const bouncePlatformPos = { x: offset.x, y: offset.y - 5, z: bounceZ };

    {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(bouncePlatformPos.x, bouncePlatformPos.y, bouncePlatformPos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(bouncePlatformExtents.x, bouncePlatformExtents.y, bouncePlatformExtents.z);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'concrete');

        const { entity } = createVisual(bouncePlatformPos, bouncePlatformExtents, [0.2, 0.2, 0.2]);
        updateVisualMatrix(entity, bouncePlatformPos, bouncePlatformExtents);
    }

    // High Restitution obstacles on the platform
    const bounceObstaclePositions = [
        { x: offset.x - 2, y: bouncePlatformPos.y + 1, z: bounceZ - 2 },
        { x: offset.x + 2, y: bouncePlatformPos.y + 1, z: bounceZ + 2 }
    ];

    bounceObstaclePositions.forEach((pos, idx) => {
        const hExtents = { x: 1, y: 1, z: 1 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setRestitution(1.5);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'rubber');

        const color = idx === 0 ? [1.0, 0.5, 0.0] : [0.0, 0.5, 1.0];
        const { entity } = createVisual(pos, hExtents, color);
        updateVisualMatrix(entity, pos, hExtents);
    });

    // --- Kinematic Sweeping Laser Blockers ---
    const laserZ = bounceZ + 15;
    const laserPlatformExtents = { x: 8, y: 0.5, z: 4 };
    const laserPlatformPos = { x: offset.x, y: offset.y - 5, z: laserZ };

    {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(laserPlatformPos.x, laserPlatformPos.y, laserPlatformPos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(laserPlatformExtents.x, laserPlatformExtents.y, laserPlatformExtents.z);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'metal');

        const { entity } = createVisual(laserPlatformPos, laserPlatformExtents, [0.15, 0.15, 0.2]);
        updateVisualMatrix(entity, laserPlatformPos, laserPlatformExtents);
    }

    // Kinematic Sweepers
    for(let i=0; i<2; i++) {
        const hExtents = { x: 4, y: 0.5, z: 0.2 };
        const zPos = laserZ + (i === 0 ? -1.5 : 1.5);
        const yPos = laserPlatformPos.y + 1;
        const startX = offset.x + (i === 0 ? -4 : 4);

        const pos = { x: startX, y: yPos, z: zPos };

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(pos.x, pos.y, pos.z);
        const body = game.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        game.world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual(pos, hExtents, [1.0, 0.0, 0.0], 0.1); // Red lasers

        game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: offset.x,
            amplitude: 4.0,
            initialPos: { ...pos },
            speed: 2.0 + i * 0.5
        });

        // Add emissive glow to sweeping lasers
        const laserLight = F.EntityManager.get().create();
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color([1.0, 0.0, 0.0])
            .intensity(10000.0)
            .falloff(5.0)
            .position([pos.x, pos.y, pos.z])
            .build(game.engine, laserLight);
        game.scene.addEntity(laserLight);

        // Push to an array to update light position with kinematic body in game loop if needed
        // For simplicity we use staticEntities since they don't move lights by default,
        // but we can add a custom update hook if required. For now, it glows statically.
        game.staticEntities.push(laserLight);
    }
}
