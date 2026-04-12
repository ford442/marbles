import { quatFromEuler } from '../math.js';

export function createMysticForestZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.2, 0.1],
        'wood'
    );

    // --- Forest Floor Area ---
    const forestStartZ = offset.z + 10;
    const forestLength = 80;
    const forestWidth = 30;

    // Dark grassy floor
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: forestStartZ + forestLength / 2 },
        floorQ,
        { x: forestWidth / 2, y: 0.5, z: forestLength / 2 },
        [0.05, 0.1, 0.05], // Very dark green
        'wood'
    );

    // --- Glowing Trees (Static Obstacles) ---
    // Cyan/Magenta glowing pillars representing magical trees
    for (let i = 0; i < 12; i++) {
        const zPos = forestStartZ + 5 + i * 6;
        const xPos = offset.x + (Math.random() * 20 - 10);
        const color = i % 2 === 0 ? [0.0, 1.0, 1.0] : [1.0, 0.0, 1.0]; // Alternating cyan and magenta

        // Tree trunk
        game.createStaticBox(
            { x: xPos, y: offset.y + 3, z: zPos },
            floorQ,
            { x: 1, y: 5, z: 1 },
            color,
            'glass'
        );

        // Sometimes spawn a jump power-up near a tree
        if (i % 4 === 0) {
            game.createPowerUp(
                { x: xPos, y: offset.y + 0.5, z: zPos - 2 },
                'jump'
            );
        }
    }

    // --- Moving Enchanted Roots (Kinematic Horizontal) ---
    // Roots that sweep across the forest floor
    for (let i = 0; i < 5; i++) {
        const zPos = forestStartZ + 15 + i * 15;
        const amplitude = 8.0 + Math.random() * 4.0;

        game.createKinematicBox(
            { x: offset.x - amplitude, y: offset.y - 0.5, z: zPos },
            { x: 3, y: 0.5, z: 0.5 },
            [0.2, 0.8, 0.2], // Glowing green roots
            'horizontal',
            offset.x,
            amplitude
        );
    }

    // --- Floating Magic Platforms (Kinematic Vertical) ---
    // Platforms that move up and down, requiring timing to cross gaps or reach higher areas
    for (let i = 0; i < 3; i++) {
        const zPos = forestStartZ + 20 + i * 20;
        const xPos = offset.x + (i % 2 === 0 ? -5 : 5);

        game.createKinematicBox(
            { x: xPos, y: offset.y + 2, z: zPos },
            { x: 2, y: 0.2, z: 2 },
            [0.8, 0.0, 1.0], // Purple magic platforms
            'vertical',
            offset.y + 2,
            4.0
        );
    }

    // --- Exit Platform ---
    const exitZ = forestStartZ + forestLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // Provide a small goal or jump point here, but the actual level goal is separate
    game.createStaticBox(
        { x: offset.x, y: offset.y + 0.5, z: exitZ + 5 },
        floorQ,
        { x: 2, y: 0.2, z: 2 },
        [0.0, 1.0, 0.5],
        'metal'
    );
}
