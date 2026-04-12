import { quatFromEuler } from '../math.js';

export function createJungleRunZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.6, 0.4],
        'wood'
    );

    // --- Water Floor ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5, z: offset.z + 30 },
        floorQ,
        { x: 15, y: 0.5, z: 30 },
        [0.0, 0.5, 0.8],
        'glass'
    );

    // --- Kinematic Swinging Logs ---
    for (let i = 0; i < 3; i++) {
        game.createKinematicBox(
            { x: offset.x - 4, y: offset.y + 1, z: offset.z + 10 + i * 15 },
            { x: 3, y: 0.5, z: 0.5 },
            [0.5, 0.3, 0.1],
            'horizontal',
            offset.x,
            4.0
        );
    }

    // --- Exit Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 65 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.6, 0.4],
        'wood'
    );

    // --- Goal ---
    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: offset.z + 65 },
        [0.0, 1.0, 0.0]
    );
}
