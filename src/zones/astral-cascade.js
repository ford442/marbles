import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createAstralCascadeZone(game, offset) {
    const F = game.Filament || game.game?.Filament;
    const engine = game.engine || game.game?.engine;
    const material = game.material || game.game?.material;
    const scene = game.scene || game.game?.scene;
    const vb = game.vb || game.game?.vb;
    const ib = game.ib || game.game?.ib;
    const world = game.physicsWorld || game.world || game.game?.physicsWorld || game.game?.world;
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    console.log('[ZONE] Creating Astral Cascade zone at', offset);

    // Helper to create a basic filament visual entity inline
    const createVisual = (pos, halfExtents, color, roughness = 0.4, bump = false) => {
        const entity = F.EntityManager.get().create();
        const matInstance = material.createInstance();
        matInstance.setColor3Parameter('baseColor', F.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', roughness);

        if (bump && game.hasProceduralMaterial) {
            matInstance.setFloatParameter('bumpScale', 0.05);
            matInstance.setFloatParameter('bumpFrequency', 30.0);
        }

        F.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, F.RenderableManager$PrimitiveType.TRIANGLES, vb, ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(engine, entity);

        scene.addEntity(entity);
        return { entity, matInstance };
    };

    // 1. Entrance Platform
    {
        const hExtents = { x: 5, y: 0.5, z: 5 };
        const pos = { x: offset.x, y: offset.y, z: offset.z };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        world.createCollider(colliderDesc, body);
        game.staticBodies?.push(body);
        audio.registerBodyMaterial(body, 'concrete');

        const { entity } = createVisual(pos, hExtents, [0.3, 0.3, 0.35]);

        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            pos.x, pos.y, pos.z, 1
        ]);
        const tcm = engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // 2. Low-Friction Ice Slide
    {
        const hExtents = { x: 6, y: 0.5, z: 20 };
        const pos = { x: offset.x, y: offset.y - 4, z: offset.z + 25 };
        const slopeAngle = 0.2; // roughly 11.5 degrees

        // Quaternion for slope around X axis
        const halfAngle = slopeAngle / 2;
        const q = { x: Math.sin(halfAngle), y: 0, z: 0, w: Math.cos(halfAngle) };

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(q);
        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z)
            .setFriction(0.02)
            .setRestitution(0.1);
        world.createCollider(colliderDesc, body);
        game.staticBodies?.push(body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual(pos, hExtents, [0.1, 0.5, 0.8], 0.05);

        // Convert quaternion to 4x4 rotation matrix
        const x = q.x, y = q.y, z = q.z, w = q.w;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        const m00 = 1 - (yy + zz), m10 = xy + wz, m20 = xz - wy;
        const m01 = xy - wz, m11 = 1 - (xx + zz), m21 = yz + wx;
        const m02 = xz + wy, m12 = yz - wx, m22 = 1 - (xx + yy);

        // Apply scale (2 * hExtents)
        const sx = hExtents.x * 2, sy = hExtents.y * 2, sz = hExtents.z * 2;

        const mat = new Float32Array([
            m00 * sx, m10 * sx, m20 * sx, 0,
            m01 * sy, m11 * sy, m21 * sy, 0,
            m02 * sz, m12 * sz, m22 * sz, 0,
            pos.x, pos.y, pos.z, 1
        ]);

        const tcm = engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // 3. Kinematic Sweeping Platforms (Asteroids/Debris)
    for (let i = 0; i < 3; i++) {
        const hExtents = { x: 3, y: 1, z: 3 };
        const zOffset = offset.z + 10 + (i * 10); // Placed along the slide
        const startX = offset.x + (i % 2 === 0 ? -10 : 10);
        // Approximate height based on slide slope
        const relZ = zOffset - (offset.z + 25);
        const startY = (offset.y - 4) - Math.tan(0.2) * relZ;

        const amplitude = 14.0;
        const speed = 2.5 + (i * 0.3);

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(startX, startY, zOffset);
        const body = world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z).setFriction(0.8);
        world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'rock');

        const { entity } = createVisual({ x: startX, y: startY, z: zOffset }, hExtents, [0.6, 0.2, 0.8], 0.6, true);

        game.movingPlatforms?.push({
            rigidBody: body,
            entity: entity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: startX, // Center of oscillation
            amplitude: amplitude,
            initialPos: { x: startX, y: startY, z: zOffset },
            speed: speed
        });
    }

    // 4. Heavy Jump Pad Boost
    {
        const hExtents = { x: 7, y: 0.5, z: 5 };
        const pos = { x: offset.x, y: offset.y - 12, z: offset.z + 55 }; // After the slide

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        world.createCollider(colliderDesc, body);
        game.staticBodies?.push(body);
        audio.registerBodyMaterial(body, 'metal');

        const { entity, matInstance } = createVisual(pos, hExtents, [0.0, 1.0, 0.8], 0.2); // Cyan
        if (game.hasProceduralMaterial) {
            matInstance.setFloatParameter('emissive', 1.0);
        }

        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            pos.x, pos.y, pos.z, 1
        ]);
        const tcm = engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);

        // Add a jump pad sensor above it
        const sensorDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, 1.0, hExtents.z).setSensor(true);
        const sensorCollider = world.createCollider(sensorDesc, body);

        // Register the jump pad in the game state (assuming standard jump pad logic)
        // Usually handled by a collision event looking for specific user data
        // For standard implementation, we add it to a list if game tracks it,
        // or set user data to trigger boost in collision handler.
        sensorCollider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

        // Using a similar approach to what game.createJumpZone does internally:
        // We'll store it so the logic loop can apply forces, or let the collision system handle it.
        // For safety, since we don't have the exact collision logic, we'll mimic jump zone
        // If jumpPads exists, add it.
        if (game.jumpPads) {
            game.jumpPads.push({
                collider: sensorCollider,
                force: 55, // Heavy boost
                cooldowns: new Map()
            });
        }
    }

    // 5. Floating Static Obstacles
    const obstacles = [
        { x: offset.x - 6, y: offset.y + 10, z: offset.z + 80 },
        { x: offset.x + 6, y: offset.y + 10, z: offset.z + 80 },
        { x: offset.x, y: offset.y + 15, z: offset.z + 90 }
    ];

    for (const obs of obstacles) {
        const hExtents = { x: 1.5, y: 1.5, z: 1.5 };

        // Random rotation for aesthetics
        const axis = { x: Math.random(), y: Math.random(), z: Math.random() };
        const len = Math.sqrt(axis.x*axis.x + axis.y*axis.y + axis.z*axis.z);
        axis.x /= len; axis.y /= len; axis.z /= len;
        const angle = Math.random() * Math.PI;
        const s = Math.sin(angle / 2);
        const q = { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) };

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(obs.x, obs.y, obs.z)
            .setRotation(q);
        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        world.createCollider(colliderDesc, body);
        game.staticBodies?.push(body);
        audio.registerBodyMaterial(body, 'rock');

        const { entity } = createVisual(obs, hExtents, [0.8, 0.1, 0.4], 0.8, true);

        // Convert quaternion to 4x4 rotation matrix
        const x = q.x, y = q.y, z = q.z, w = q.w;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        const m00 = 1 - (yy + zz), m10 = xy + wz, m20 = xz - wy;
        const m01 = xy - wz, m11 = 1 - (xx + zz), m21 = yz + wx;
        const m02 = xz + wy, m12 = yz - wx, m22 = 1 - (xx + yy);

        const sx = hExtents.x * 2, sy = hExtents.y * 2, sz = hExtents.z * 2;

        const mat = new Float32Array([
            m00 * sx, m10 * sx, m20 * sx, 0,
            m01 * sy, m11 * sy, m21 * sy, 0,
            m02 * sz, m12 * sz, m22 * sz, 0,
            obs.x, obs.y, obs.z, 1
        ]);

        const tcm = engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    // 6. Exit Platform
    {
        const hExtents = { x: 7.5, y: 0.5, z: 7.5 };
        const pos = { x: offset.x, y: offset.y + 20, z: offset.z + 110 };
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(floorQ);
        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        world.createCollider(colliderDesc, body);
        game.staticBodies?.push(body);
        audio.registerBodyMaterial(body, 'concrete');

        const { entity } = createVisual(pos, hExtents, [0.3, 0.3, 0.35]);

        const mat = new Float32Array([
            hExtents.x * 2, 0, 0, 0,
            0, hExtents.y * 2, 0, 0,
            0, 0, hExtents.z * 2, 0,
            pos.x, pos.y, pos.z, 1
        ]);
        const tcm = engine.getTransformManager();
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }

    console.log('[ZONE] Astral Cascade zone created successfully');
}
