import { quatFromEuler } from '../math.js';

export function createZenGardenZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.7, 0.6],
        'wood'
    );

    // --- Sand Floor ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 1, z: offset.z + 30 },
        floorQ,
        { x: 20, y: 0.5, z: 25 },
        [0.9, 0.8, 0.6],
        'concrete'
    );

    // --- Bamboo Bridge ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 65 },
        floorQ,
        { x: 2, y: 0.2, z: 10 },
        [0.4, 0.8, 0.4],
        'wood'
    );

    // --- Exit Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 80 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.7, 0.6],
        'wood'
    );

    // --- Goal Zone ---
    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: offset.z + 80 },
        [1.0, 1.0, 1.0]
    );
}
