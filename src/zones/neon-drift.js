import { quatFromEuler } from '../math.ts';

export function createNeonDriftZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    console.log('[ZONE] Creating Neon Drift zone at', offset);

    // 1. Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.3],
        'concrete'
    );

    // 2. Low-Friction Drift Curve (using multiple boxes to simulate a curve)
    const curveSegments = 10;
    const curveRadius = 15;
    const curveAngle = Math.PI / 2; // 90 degrees turn
    const driftZOffset = offset.z + 5; // Start a bit ahead

    for (let i = 0; i < curveSegments; i++) {
        const t = i / (curveSegments - 1); // 0 to 1
        const angle = t * curveAngle;

        const cx = offset.x + curveRadius - Math.cos(angle) * curveRadius;
        const cz = driftZOffset + Math.sin(angle) * curveRadius;

        const q = quatFromEuler(0, angle, 0);

        // Low friction glass material
        const pos = { x: cx, y: offset.y - 1 - (t * 2), z: cz };

        game.createStaticBox(
            pos,
            q,
            { x: 4, y: 0.25, z: 2 },
            [0.1, 0.8, 0.9], // Cyan
            'glass'
        );

        // Add side rails to prevent falling off immediately, but make them low friction too
        game.createStaticBox(
            { x: cx - Math.cos(angle) * 3.5, y: pos.y + 0.5, z: cz + Math.sin(angle) * 3.5 },
            q,
            { x: 0.25, y: 1.0, z: 2 },
            [0.9, 0.1, 0.8], // Pink rail
            'glass'
        );
        game.createStaticBox(
            { x: cx + Math.cos(angle) * 3.5, y: pos.y + 0.5, z: cz - Math.sin(angle) * 3.5 },
            q,
            { x: 0.25, y: 1.0, z: 2 },
            [0.9, 0.1, 0.8], // Pink rail
            'glass'
        );
    }

    // 3. Gap jump after drift
    const endAngle = curveAngle;
    const endX = offset.x + curveRadius - Math.cos(endAngle) * curveRadius;
    const endZ = driftZOffset + Math.sin(endAngle) * curveRadius;
    const jumpDirX = Math.sin(endAngle);
    const jumpDirZ = Math.cos(endAngle);
    const jumpY = offset.y - 3;

    // Ramp
    const rampQ = quatFromEuler(0.2, endAngle, 0); // pitch up a bit
    game.createStaticBox(
        { x: endX + jumpDirX * 3, y: jumpY, z: endZ + jumpDirZ * 3 },
        rampQ,
        { x: 4, y: 0.25, z: 3 },
        [0.9, 0.9, 0.2], // Yellow ramp
        'concrete'
    );

    // 4. Kinematic Platforms in the gap
    const gapDistance = 15;
    for(let i=1; i<=2; i++) {
        const platX = endX + jumpDirX * (3 + i * gapDistance / 3);
        const platZ = endZ + jumpDirZ * (3 + i * gapDistance / 3);
        const platY = jumpY + i * 1.5;

        game.createKinematicBox(
            { x: platX, y: platY, z: platZ },
            { x: 2, y: 0.5, z: 2 },
            [0.8, 0.1, 0.1], // Red platform
            i % 2 === 0 ? 'horizontal' : 'vertical', // oscillate type
            i % 2 === 0 ? platX : platY, // center of oscillation
            2.5 // amplitude
        );
    }

    // 5. Landing platform and Goal
    const landX = endX + jumpDirX * (3 + gapDistance);
    const landZ = endZ + jumpDirZ * (3 + gapDistance);
    const landY = jumpY + 3;

    game.createStaticBox(
        { x: landX, y: landY, z: landZ },
        quatFromEuler(0, endAngle, 0),
        { x: 6, y: 0.5, z: 6 },
        [0.2, 0.8, 0.4], // Green
        'concrete'
    );
}
