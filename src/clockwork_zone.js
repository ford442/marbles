import { quatFromEuler } from './math.js';

export function createClockworkZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Base Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 8, y: 0.5, z: 8 },
        [0.4, 0.4, 0.45],
        'concrete'
    );

    // --- Gear 1 ---
    // A simple rotating platform
    const gear1Pos = { x: offset.x, y: offset.y, z: offset.z + 12 };
    const gear1Speed = 0.02;
    const gear1Size = { x: 4, y: 0.2, z: 0.8 };
    const gear1Color = [0.6, 0.5, 0.3];

    // Part 1 of the cross
    game.createRotatingBox(
        gear1Pos,
        gear1Size,
        gear1Color,
        'y',
        gear1Speed,
        0
    );
    // Part 2 of the cross
    game.createRotatingBox(
        gear1Pos,
        gear1Size,
        gear1Color,
        'y',
        gear1Speed,
        Math.PI / 2
    );

    // --- Gear 2 ---
    // Faster, opposite direction
    const gear2Pos = { x: offset.x, y: offset.y + 1, z: offset.z + 24 };
    const gear2Speed = -0.03;
    const gear2Size = { x: 3.5, y: 0.2, z: 0.8 };
    const gear2Color = [0.5, 0.5, 0.6];

    game.createRotatingBox(
        gear2Pos,
        gear2Size,
        gear2Color,
        'y',
        gear2Speed,
        0
    );
    game.createRotatingBox(
        gear2Pos,
        gear2Size,
        gear2Color,
        'y',
        gear2Speed,
        Math.PI / 2
    );

    // --- Gear 3 ---
    // Large, slow
    const gear3Pos = { x: offset.x, y: offset.y + 2, z: offset.z + 38 };
    const gear3Speed = 0.01;
    const gear3Size = { x: 5, y: 0.2, z: 1.0 };
    const gear3Color = [0.7, 0.4, 0.3];

    game.createRotatingBox(
        gear3Pos,
        gear3Size,
        gear3Color,
        'y',
        gear3Speed,
        0
    );
    game.createRotatingBox(
        gear3Pos,
        gear3Size,
        gear3Color,
        'y',
        gear3Speed,
        Math.PI / 2
    );
    // Extra cross for 8-spoke look
    game.createRotatingBox(
        gear3Pos,
        gear3Size,
        gear3Color,
        'y',
        gear3Speed,
        Math.PI / 4
    );
    game.createRotatingBox(
        gear3Pos,
        gear3Size,
        gear3Color,
        'y',
        gear3Speed,
        3 * Math.PI / 4
    );

    // --- Static Platform / Checkpoint ---
    game.createStaticBox(
        { x: offset.x, y: offset.y + 2, z: offset.z + 52 },
        floorQ,
        { x: 4, y: 0.5, z: 4 },
        [0.3, 0.3, 0.35],
        'concrete'
    );

    // --- Gear 4 ---
    // Vertical rotation? No, 'y' axis only supported easily right now.
    // Let's stick to horizontal platforms for gameplay simplicity first.

    const gear4Pos = { x: offset.x, y: offset.y + 3, z: offset.z + 64 };
    const gear4Speed = 0.04; // Very fast
    const gear4Size = { x: 3, y: 0.2, z: 0.6 };
    const gear4Color = [0.8, 0.3, 0.3];

    game.createRotatingBox(
        gear4Pos,
        gear4Size,
        gear4Color,
        'y',
        gear4Speed,
        0
    );
    game.createRotatingBox(
        gear4Pos,
        gear4Size,
        gear4Color,
        'y',
        gear4Speed,
        Math.PI / 2
    );

    // --- Final Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y + 3, z: offset.z + 76 },
        floorQ,
        { x: 6, y: 0.5, z: 6 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // Goal visual indicator (handled by game logic, but we can add a visual marker if needed)
    // The level definition handles the goal trigger.
}
