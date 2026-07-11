import { quatFromEuler } from '../math.js';

export function createGlassBridgeZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Glass Bridge Segments ---
    const bridgeStartZ = offset.z + 10;
    const bridgeLength = 50;
    const segmentCount = 10;
    const segmentLength = bridgeLength / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
        const zPos = bridgeStartZ + i * segmentLength;
        // make every other segment missing to create jumps
        if (i % 3 === 2) {
            continue;
        }

        game.createStaticBox(
            { x: offset.x, y: offset.y, z: zPos },
            floorQ,
            { x: 3, y: 0.1, z: segmentLength / 2 - 0.5 },
            [0.8, 0.9, 1.0], // Glassy blue-ish color
            'glass'
        );
    }

    // --- Moving Obstacles (Pendulums/Sweepers) ---
    for (let i = 0; i < 3; i++) {
        const zPos = bridgeStartZ + 15 + i * 15;
        const moveType = 'horizontal';
        const amplitude = 4.0;

        game.createKinematicBox(
            { x: offset.x - amplitude, y: offset.y + 0.5, z: zPos },
            { x: 1.5, y: 0.5, z: 0.5 },
            [0.8, 0.2, 0.2], // Red sweeper
            moveType,
            offset.x,
            amplitude + Math.random() * 2.0
        );
    }

    // --- Exit Platform ---
    const exitZ = bridgeStartZ + bridgeLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.0, 1.0, 1.0] // Cyan goal
    );
}
