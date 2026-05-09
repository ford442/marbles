import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createNeonPulseGridZone(game, offset) {
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

    // --- Low-Friction Ice Grid ---
    const gridZ = offset.z + 30;
    const gridLength = 50;
    const gridExtents = { x: 10, y: 0.5, z: gridLength / 2 };
    const gridPos = { x: offset.x, y: offset.y - 2, z: gridZ };

    {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(gridPos.x, gridPos.y, gridPos.z)
            .setRotation(floorQ);
        const body = game.world.createRigidBody(bodyDesc);
        // Extremely low friction
        const colliderDesc = RAPIER.ColliderDesc.cuboid(gridExtents.x, gridExtents.y, gridExtents.z).setFriction(0.0);
        game.world.createCollider(colliderDesc, body);
        game.staticBodies.push(body);
        audio.registerBodyMaterial(body, 'glass');

        const { entity } = createVisual(gridPos, gridExtents, [0.05, 0.0, 0.08]); // Dark purple/black base
        updateVisualMatrix(entity, gridPos, gridExtents, floorQ);
    }

    // --- Kinematic Pulse Walls ---
    for(let i=0; i<3; i++) {
        const hExtents = { x: 4, y: 1.5, z: 0.5 };
        const zPos = gridZ - 15 + i * 15;
        const yPos = gridPos.y + 2;
        const startX = offset.x + (i % 2 === 0 ? -4 : 4);

        const pos = { x: startX, y: yPos, z: zPos };

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(pos.x, pos.y, pos.z);
        const body = game.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hExtents.x, hExtents.y, hExtents.z);
        game.world.createCollider(colliderDesc, body);
        audio.registerBodyMaterial(body, 'glass');

        // Bright red/magenta walls
        const { entity } = createVisual(pos, hExtents, [1.0, 0.0, 0.5], 0.1);

        game.movingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: hExtents,
            type: 'horizontal',
            center: offset.x,
            amplitude: 6.0,
            initialPos: { ...pos },
            speed: 1.5 + i * 0.25
        });

        // Add emissive glow to pulse walls
        const wallLight = F.EntityManager.get().create();
        F.LightManager.Builder(F['LightManager$Type'].POINT)
            .color([1.0, 0.0, 0.5])
            .intensity(20000.0)
            .falloff(8.0)
            .position([pos.x, pos.y, pos.z])
            .build(game.engine, wallLight);
        game.scene.addEntity(wallLight);
        game.staticEntities.push(wallLight);
    }
}
