import { quatFromEuler } from '../math.js';

export function createFloatingIslandsZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.8, 0.2],
        'concrete'
    );

    // --- First Moving Island (Horizontal) ---
    game.createKinematicBox(
        { x: offset.x, y: offset.y + 2, z: offset.z + 15 },
        { x: 3, y: 0.5, z: 3 },
        [0.2, 0.6, 0.8],
        'horizontal',
        offset.x,
        5.0
    );

    // --- Second Moving Island (Vertical) ---
    game.createKinematicBox(
        { x: offset.x, y: offset.y + 4, z: offset.z + 30 },
        { x: 3, y: 0.5, z: 3 },
        [0.8, 0.6, 0.2],
        'vertical',
        offset.y + 4,
        3.0
    );

    // --- Dynamic Obstacles (Crates) on Second Island ---
    for (let i = 0; i < 3; i++) {
        game.createDynamicBox(
            { x: offset.x + (Math.random() * 2 - 1), y: offset.y + 5 + i * 1.5, z: offset.z + 30 + (Math.random() * 2 - 1) },
            floorQ,
            { x: 0.5, y: 0.5, z: 0.5 },
            [0.8, 0.4, 0.1],
            1.0,
            'wood'
        );
    }

    // --- Power-Up (Jump) on Second Island ---
    game.createPowerUp(
        { x: offset.x, y: offset.y + 5.5, z: offset.z + 30 },
        'jump'
    );

    // --- Final Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y + 6, z: offset.z + 45 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // --- Goal Zone ---
    game.createGoalZone(
        { x: offset.x, y: offset.y + 6.5, z: offset.z + 45 },
        [1.0, 0.5, 0.0]
    );
}
