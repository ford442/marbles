import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createNeonAbyssZone(game, offset) {
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
        const m10 = xy + wz;
        const m20 = xz - wy;

        const m01 = xy - wz;
        const m11 = 1 - (xx + zz);
        const m21 = yz + wx;

        const m02 = xz + wy;
        const m12 = yz - wx;
        const m22 = 1 - (xx + yy);

        const tm = game.engine.getTransformManager();
        tm.create(entity);
        const inst = tm.getInstance(entity);

        // Apply scaling matrix based on extents
        const scaleMatrix = [
            hExtents.x, 0, 0, 0,
            0, hExtents.y, 0, 0,
            0, 0, hExtents.z, 0,
            0, 0, 0, 1
        ];

        // Apply rotation and translation
        const transformMatrix = [
            m00, m10, m20, 0,
            m01, m11, m21, 0,
            m02, m12, m22, 0,
            pos.x, pos.y, pos.z, 1
        ];

        // Combine (simplified for this specific use case)
        const finalMatrix = [
            transformMatrix[0] * scaleMatrix[0], transformMatrix[1] * scaleMatrix[0], transformMatrix[2] * scaleMatrix[0], 0,
            transformMatrix[4] * scaleMatrix[5], transformMatrix[5] * scaleMatrix[5], transformMatrix[6] * scaleMatrix[5], 0,
            transformMatrix[8] * scaleMatrix[10], transformMatrix[9] * scaleMatrix[10], transformMatrix[10] * scaleMatrix[10], 0,
            transformMatrix[12], transformMatrix[13], transformMatrix[14], 1
        ];

        tm.setTransform(inst, finalMatrix);
    };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.1, 0.1, 0.1],
        'metal'
    );

    // Add ambient particles at entrance
    if (game.particleSystem) {
        game.particleSystem.addAmbientEmitter({ x: offset.x, y: offset.y + 2, z: offset.z }, [1.0, 0.2, 0.8]);
    }

    // --- The Abyss Slide (Low Friction) ---
    // Steep angle down
    const slideAngle = Math.PI / 6; // 30 degrees
    const slideLength = 50;
    const slideHalfExtents = { x: 8, y: 0.5, z: slideLength / 2 };

    const slidePos = {
        x: offset.x,
        y: offset.y - Math.sin(slideAngle) * (slideLength / 2) - 5,
        z: offset.z + Math.cos(slideAngle) * (slideLength / 2) + 10
    };
    const slideRotQ = {
        x: Math.sin(slideAngle / 2),
        y: 0,
        z: 0,
        w: Math.cos(slideAngle / 2)
    };

    // Low-friction ice slide
    const slideBody = game.physicsWorld._createSimBody(
        'fixed',
        slidePos,
        slideRotQ,
        { type: 'cuboid', halfExtents: slideHalfExtents, friction: 0.01, restitution: 0.1 } // Very low friction
    );
    audio.registerBodyMaterial(slideBody, 'ice');

    // Add visual
    const slideColor = [0.0, 0.8, 1.0]; // Cyan ice
    const slideVisual = createVisual(slidePos, slideHalfExtents, slideColor, 0.05);
    updateVisualMatrix(slideVisual.entity, slidePos, slideHalfExtents, slideRotQ);

    // --- Kinematic Hazards (Neon Lasers sweeping across the slide) ---
    const numLasers = 3;
    const laserSpacing = slideLength / (numLasers + 1);

    for (let i = 1; i <= numLasers; i++) {
        // Calculate position along the sloped slide
        const lZ = slidePos.z - (slideLength / 2 * Math.cos(slideAngle)) + i * laserSpacing * Math.cos(slideAngle);
        const lY = slidePos.y + (slideLength / 2 * Math.sin(slideAngle)) - i * laserSpacing * Math.sin(slideAngle) + 1.5;

        const laserPos = { x: offset.x, y: lY, z: lZ };
        const laserExtents = { x: 1, y: 1, z: 1 };

        // Use createKinematicBox helper
        // signature: (pos, halfExtents, color, type, center, amplitude)
        game.createKinematicBox(
            laserPos,
            laserExtents,
            [1.0, 0.1, 0.8], // Neon pink
            'horizontal',
            laserPos.x,
            6 // Sweep width
        );
    }

    // Add particles along the slide
    if (game.particleSystem) {
        for (let i = 1; i <= numLasers; i++) {
            const lZ = slidePos.z - (slideLength / 2 * Math.cos(slideAngle)) + i * laserSpacing * Math.cos(slideAngle);
            const lY = slidePos.y + (slideLength / 2 * Math.sin(slideAngle)) - i * laserSpacing * Math.sin(slideAngle) + 1.5;
            game.particleSystem.addAmbientEmitter({ x: offset.x - 8, y: lY, z: lZ }, [0.0, 0.8, 1.0]);
            game.particleSystem.addAmbientEmitter({ x: offset.x + 8, y: lY, z: lZ }, [0.0, 0.8, 1.0]);
        }
    }

    // --- Landing Pad ---
    const landingZ = slidePos.z + Math.cos(slideAngle) * (slideLength / 2) + 10;
    const landingY = slidePos.y - Math.sin(slideAngle) * (slideLength / 2);

    game.createStaticBox(
        { x: offset.x, y: landingY, z: landingZ },
        floorQ,
        { x: 12, y: 0.5, z: 12 },
        [0.1, 0.1, 0.1],
        'metal'
    );

    if (game.particleSystem) {
        game.particleSystem.addAmbientEmitter({ x: offset.x, y: landingY + 2, z: landingZ }, [1.0, 0.2, 0.8]);
    }
}
