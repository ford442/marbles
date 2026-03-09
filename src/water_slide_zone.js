import { quatFromEuler } from './math.js';

export function createWaterSlideZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Start Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'concrete'
    );

    // --- The Slide ---
    const slideSegments = 40;
    const slideWidth = 4;
    const slideThickness = 0.5;
    const wallHeight = 1.5;
    const wallThickness = 0.5;
    const segmentLength = 2.0;

    const waterColor = [0.0, 0.5, 1.0];
    const wallColor = [0.1, 0.7, 1.0];

    let currentX = offset.x;
    let currentY = offset.y;
    let currentZ = offset.z + 5;
    let currentYaw = 0;

    for (let i = 0; i < slideSegments; i++) {
        // Curve the slide
        currentYaw += Math.sin(i * 0.2) * 0.15;

        // Pitch downwards
        const pitch = -0.2 - Math.sin(i * 0.1) * 0.1;

        // Bank the turn
        const roll = -Math.sin(i * 0.2) * 0.3;

        const q = quatFromEuler(currentYaw, pitch, roll);

        // Floor
        game.createStaticBox(
            { x: currentX, y: currentY, z: currentZ },
            q,
            { x: slideWidth / 2, y: slideThickness / 2, z: segmentLength / 2 },
            waterColor,
            'glass' // smooth material
        );

        // Left Wall
        game.createStaticBox(
            {
                x: currentX - Math.cos(currentYaw) * (slideWidth / 2 + wallThickness / 2),
                y: currentY + wallHeight / 2,
                z: currentZ + Math.sin(currentYaw) * (slideWidth / 2 + wallThickness / 2)
            },
            q,
            { x: wallThickness / 2, y: wallHeight / 2, z: segmentLength / 2 },
            wallColor,
            'glass'
        );

        // Right Wall
        game.createStaticBox(
            {
                x: currentX + Math.cos(currentYaw) * (slideWidth / 2 + wallThickness / 2),
                y: currentY + wallHeight / 2,
                z: currentZ - Math.sin(currentYaw) * (slideWidth / 2 + wallThickness / 2)
            },
            q,
            { x: wallThickness / 2, y: wallHeight / 2, z: segmentLength / 2 },
            wallColor,
            'glass'
        );

        // Add arches occasionally
        if (i > 0 && i % 8 === 0) {
            game.createStaticBox(
                { x: currentX, y: currentY + wallHeight + 1.0, z: currentZ },
                q,
                { x: slideWidth / 2 + wallThickness, y: 0.2, z: 0.5 },
                [0.9, 0.9, 1.0],
                'metal'
            );
        }

        // Move to next segment
        currentX += Math.sin(currentYaw) * segmentLength;
        currentY += Math.sin(pitch) * segmentLength;
        currentZ += Math.cos(currentYaw) * segmentLength;
    }

    // --- Splash Pool ---
    // End of slide flattens out
    const poolRadius = 15;
    const poolY = currentY - 1;
    const poolZ = currentZ + poolRadius;
    const poolX = currentX;

    game.createStaticBox(
        { x: poolX, y: poolY, z: poolZ },
        floorQ,
        { x: poolRadius, y: 0.5, z: poolRadius },
        waterColor,
        'glass'
    );

    // Pool Walls (Octagon)
    const numWalls = 8;
    for (let i = 0; i < numWalls; i++) {
        const angle = (i / numWalls) * Math.PI * 2;
        const x = poolX + Math.sin(angle) * poolRadius;
        const z = poolZ + Math.cos(angle) * poolRadius;
        const q = quatFromEuler(angle, 0, 0);

        game.createStaticBox(
            { x: x, y: poolY + wallHeight/2, z: z },
            q,
            { x: poolRadius * 0.45, y: wallHeight/2, z: 0.5 },
            wallColor,
            'concrete'
        );
    }

    // --- Goal at the end of the pool ---
    const goalY = poolY + 1.0;
    const goalZ = poolZ + poolRadius - 3;

    game.createStaticBox(
        { x: poolX, y: goalY - 0.5, z: goalZ },
        floorQ,
        { x: 3, y: 0.5, z: 3 },
        [1.0, 0.8, 0.0],
        'metal'
    );

    // Goal zone creates the trigger (just visually represented here)
    // The actual goal is defined in levels.js
}
