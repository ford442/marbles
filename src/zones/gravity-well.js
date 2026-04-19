import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createGravityWellZone(game, offset) {
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

    // --- Gravity Well Funnel (Angled Icy Slopes) ---
    const funnelStartZ = offset.z + 20;
    const funnelRadius = 15;
    const segments = 8;
    const slopeAngle = 0.2; // Radians

    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const xDist = Math.sin(angle) * (funnelRadius / 2);
        const zDist = Math.cos(angle) * (funnelRadius / 2);

        const pos = {
            x: offset.x + xDist,
            y: offset.y - 5,
            z: funnelStartZ + zDist
        };

        const hExtents = { x: funnelRadius / 1.5, y: 0.5, z: funnelRadius / 1.5 };

        // Rotation to angle it down towards the center
        // A rough orientation to make a funnel
        const pitch = -Math.cos(angle) * slopeAngle;
        const roll = Math.sin(angle) * slopeAngle;

        // Convert simple pitch/roll/yaw to quaternion roughly
        const cy = Math.cos(0 * 0.5);
        const sy = Math.sin(0 * 0.5);
        const cp = Math.cos(pitch * 0.5);
        const sp = Math.sin(pitch * 0.5);
        const cr = Math.cos(roll * 0.5);
        const sr = Math.sin(roll * 0.5);

        const q = {
            w: cr * cp * cy + sr * sp * sy,
            x: sr * cp * cy - cr * sp * sy,
            y: cr * sp * cy + sr * cp * sy,
            z: cr * cp * sy - sr * sp * cy
        };

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(q);
        const body = game.world.createRigidBody(bodyDesc);

        // Very low friction for ice
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.01);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual(pos, hExtents, [0.5, 0.7, 1.0], 0.0); // Ice color

        // Create rotation matrix for visuals
        // Filament transforms are column-major
        // First get the 3x3 rotation from quat
        const x2 = q.x + q.x, y2 = q.y + q.y, z2 = q.z + q.z;
        const xx = q.x * x2, xy = q.x * y2, xz = q.x * z2;
        const yy = q.y * y2, yz = q.y * z2, zz = q.z * z2;
        const wx = q.w * x2, wy = q.w * y2, wz = q.w * z2;

        // Correct quaternion to matrix conversion (standard column-major)
        const m00 = 1 - (yy + zz);
        const m01 = xy - wz;
        const m02 = xz + wy;
        const m10 = xy + wz;
        const m11 = 1 - (xx + zz);
        const m12 = yz - wx;
        const m20 = xz - wy;
        const m21 = yz + wx;
        const m22 = 1 - (xx + yy);

        // Apply scale
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

    // --- Emissive Core ---
    const corePos = { x: offset.x, y: offset.y - 7, z: funnelStartZ };
    const lightEntity = F.EntityManager.get().create();
    F.LightManager.Builder(F['LightManager$Type'].POINT)
        .color([0.1, 0.9, 0.8]) // Cyan/Teal glow
        .intensity(80000.0)
        .falloff(25.0)
        .position([corePos.x, corePos.y, corePos.z])
        .build(game.engine, lightEntity);
    game.scene.addEntity(lightEntity);
    game.staticEntities.push(lightEntity);

    // Provide a small central platform above the core to bounce on or rest
    {
        const hExtents = { x: 2, y: 0.5, z: 2 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(corePos.x, corePos.y + 1, corePos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);

        // High restitution (bouncy) so player doesn't easily get stuck in the well
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setRestitution(1.5);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'metal');

        const { entity } = createVisual(corePos, hExtents, [0.1, 0.9, 0.8]);

        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            corePos.x, corePos.y + 1, corePos.z, 1
        ]);
        const tcm = game.engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // --- Orbiting Ice Blocks (Kinematic) ---
    for (let i = 0; i < 4; i++) {
        const hExtents = { x: 2, y: 0.5, z: 2 };
        const zPos = funnelStartZ + (i % 2 === 0 ? 5 : -5);
        const yPos = offset.y - 2;
        const pos = { x: offset.x, y: yPos, z: zPos };

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(pos.x, pos.y, pos.z);
        const body = game.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.01);
        game.world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual(pos, hExtents, [0.8, 0.9, 1.0], 0.1, true);

        game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: offset.x,
            amplitude: 10.0,
            initialPos: { ...pos },
            speed: 1.5 + Math.random()
        });
    }

    // --- Exit Platform ---
    {
        const hExtents = { x: 5, y: 0.5, z: 5 };
        const pos = { x: offset.x, y: offset.y - 2, z: offset.z + 50 };
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
