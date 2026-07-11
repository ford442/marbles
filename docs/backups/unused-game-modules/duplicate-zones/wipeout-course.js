import { quatFromEuler } from '../math.js';

export function createWipeoutCourseZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.4, 0.8],
        'concrete'
    );

    const courseStartZ = offset.z + 10;
    const courseLength = 60;

    // --- Water Hazard Floor ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5, z: courseStartZ + courseLength / 2 },
        floorQ,
        { x: 15, y: 0.5, z: courseLength / 2 },
        [0.0, 0.5, 1.0], // Blue water
        'glass'
    );

    // --- Bouncing Platforms ---
    for (let i = 0; i < 4; i++) {
        const zPos = courseStartZ + 5 + i * 12;
        const xPos = offset.x + (i % 2 === 0 ? -3 : 3);

        game.createDynamicBox(
            { x: xPos, y: offset.y, z: zPos },
            floorQ,
            { x: 2, y: 0.5, z: 2 },
            [1.0, 0.2, 0.2], // Red platforms
            0, // static dynamic box
            'wood',
            -1.0 // Bouncy logic (negative gravity scale can create interesting effects or act as a base for custom logic)
        );
    }

    // --- Sweeper Obstacles (Horizontal Kinematic) ---
    for (let i = 0; i < 3; i++) {
        const zPos = courseStartZ + 15 + i * 15;

        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos },
            { x: 6, y: 0.5, z: 0.5 },
            [0.8, 0.8, 0.2], // Yellow sweepers
            'horizontal',
            offset.x,
            4.0
        );
    }

    // --- Vertical Pistons (Vertical Kinematic) ---
    for (let i = 0; i < 2; i++) {
        const zPos = courseStartZ + 25 + i * 20;

        game.createKinematicBox(
            { x: offset.x, y: offset.y - 2, z: zPos },
            { x: 2, y: 3, z: 2 },
            [0.2, 0.8, 0.2], // Green pistons
            'vertical',
            offset.y,
            4.0
        );
    }

    // --- Exit Platform ---
    const exitZ = courseStartZ + courseLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.0, 1.0, 0.5] // Greenish goal
    );
}
