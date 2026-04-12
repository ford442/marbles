import { quatFromEuler } from '../math.js';

export function createDesertRuinsZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.7, 0.5], // Sandy color
        'concrete'
    );

    const ruinsStartZ = offset.z + 10;
    const ruinsLength = 70;

    // --- Sandy Floor ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: ruinsStartZ + ruinsLength / 2 },
        floorQ,
        { x: 15, y: 0.5, z: ruinsLength / 2 },
        [0.9, 0.8, 0.6], // Sand
        'concrete'
    );

    // --- Static Stone Pillars ---
    for (let i = 0; i < 6; i++) {
        const zPos = ruinsStartZ + 5 + i * 12;
        const xPos = offset.x + (i % 2 === 0 ? -6 : 6);
        game.createStaticBox(
            { x: xPos, y: offset.y + 4, z: zPos },
            floorQ,
            { x: 2, y: 6, z: 2 },
            [0.6, 0.5, 0.4], // Stone
            'concrete'
        );
    }

    // --- Falling Blocks (Dynamic) ---
    for (let i = 0; i < 4; i++) {
        const zPos = ruinsStartZ + 15 + i * 15;
        const xPos = offset.x + (Math.random() * 8 - 4);
        game.createDynamicBox(
            { x: xPos, y: offset.y + 15 + Math.random() * 5, z: zPos },
            floorQ,
            { x: 1.5, y: 1.5, z: 1.5 },
            [0.7, 0.6, 0.5], // Sandstone block
            2.0,
            'concrete'
        );
    }

    // --- Moving Kinematic Sandstone Platforms ---
    for (let i = 0; i < 3; i++) {
        const zPos = ruinsStartZ + 10 + i * 20;
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos },
            { x: 3, y: 0.5, z: 3 },
            [0.8, 0.7, 0.5], // Sandstone
            'horizontal',
            offset.x,
            5.0
        );
    }

    // --- Exit Platform ---
    const exitZ = ruinsStartZ + ruinsLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.7, 0.5],
        'concrete'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [1.0, 0.8, 0.0] // Gold goal
    );
}
