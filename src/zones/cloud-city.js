import { quatFromEuler } from '../math.js';

export function createCloudCityZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.9, 1.0], // Light blue / white
        'concrete'
    );

    const cityStartZ = offset.z + 10;
    const cityLength = 80;

    // --- Floating Cloud Platforms ---
    for (let i = 0; i < 6; i++) {
        const zPos = cityStartZ + i * 12;
        const xPos = offset.x + (i % 2 === 0 ? -4 : 4);

        // These can be bouncy or just look soft
        game.createDynamicBox(
            { x: xPos, y: offset.y + (i % 3), z: zPos },
            floorQ,
            { x: 3, y: 0.5, z: 3 },
            [0.95, 0.95, 1.0], // White/blue clouds
            0, // static dynamic box
            'wood',
            -0.5 // Slightly bouncy
        );
    }

    // --- Sweeping Gusts (Kinematic) ---
    for (let i = 0; i < 4; i++) {
        const zPos = cityStartZ + 15 + i * 15;
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 2, z: zPos },
            { x: 5, y: 1.5, z: 0.5 },
            [0.8, 0.9, 1.0], // Pale blue gust
            'horizontal',
            offset.x,
            6.0
        );
    }

    // --- Exit Platform ---
    const exitZ = cityStartZ + cityLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.9, 1.0],
        'concrete'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.8, 0.9, 1.0] // Soft blue goal
    );
}
