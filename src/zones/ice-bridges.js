import { quatFromEuler } from '../math.js';
import { createZoneLight } from './methods/visuals.js';
import { decorateIceBridges } from './methods/decorations.js';

export function createIceBridgesZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.6, 0.8, 1.0], // Light icy blue
        'glass'
    );

    const bridgeStartZ = offset.z + 10;
    const bridgeLength = 60;

    // --- Ice Bridges (Static) ---
    // Multiple narrow segments
    const segmentCount = 6;
    const segmentLength = bridgeLength / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
        const zPos = bridgeStartZ + i * segmentLength;
        // Make gaps between segments
        if (i % 2 !== 0) {
            continue;
        }

        game.createStaticBox(
            { x: offset.x, y: offset.y, z: zPos },
            floorQ,
            { x: 1.5, y: 0.2, z: segmentLength / 2 - 1.0 }, // Narrow, thin bridges
            [0.8, 0.9, 1.0], // Ice color
            'glass'
        );
    }

    // --- Spinning Ice Obstacles (Kinematic) ---
    for (let i = 0; i < 3; i++) {
        const zPos = bridgeStartZ + 15 + i * 20;

        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos },
            { x: 4, y: 0.5, z: 0.5 },
            [0.5, 0.8, 1.0], // Darker ice blue
            'horizontal',
            offset.x,
            4.0
        );
    }

    // --- Exit Platform ---
    const exitZ = bridgeStartZ + bridgeLength;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.6, 0.8, 1.0],
        'glass'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.0, 1.0, 1.0] // Cyan goal
    );

    // --- Dynamic Ice / Arctic Lights ---
    // Cold pale-blue light casting an icy ambiance over the bridges
    createZoneLight(game, 'POINT',
        { x: offset.x - 5, y: offset.y + 6, z: bridgeStartZ + 10 },
        [0.6, 0.85, 1.0], 50000.0, 22.0);

    createZoneLight(game, 'POINT',
        { x: offset.x + 5, y: offset.y + 6, z: bridgeStartZ + 35 },
        [0.5, 0.8, 1.0], 55000.0, 24.0);

    decorateIceBridges(game, offset);
}
