import { quatFromEuler } from '../math.js';

export function createLaserGridZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Laser Grid Area ---
    const gridStartZ = offset.z + 10;
    const gridLength = 30;

    // Floor underneath the grid (safe ground)
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: gridStartZ + gridLength / 2 },
        floorQ,
        { x: 5, y: 0.5, z: gridLength / 2 + 5 },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    // Side Walls to keep marble in bounds
    game.createStaticBox(
        { x: offset.x - 5, y: offset.y + 2, z: gridStartZ + gridLength / 2 },
        floorQ,
        { x: 0.5, y: 2, z: gridLength / 2 + 5 },
        [0.2, 0.2, 0.2],
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + 5, y: offset.y + 2, z: gridStartZ + gridLength / 2 },
        floorQ,
        { x: 0.5, y: 2, z: gridLength / 2 + 5 },
        [0.2, 0.2, 0.2],
        'metal'
    );

    // --- Horizontal Lasers (Kinematic) ---
    // Fast moving lasers spanning the width
    for (let i = 0; i < 5; i++) {
        const zPos = gridStartZ + i * 6;
        const yPos = offset.y + 0.6 + (i % 2 === 0 ? 0.0 : 1.0); // Stagger heights slightly

        game.createKinematicBox(
            { x: offset.x - 4, y: yPos, z: zPos },
            { x: 2, y: 0.1, z: 0.1 }, // Thin laser
            [1.0, 0.0, 0.0], // Red color
            'horizontal',
            offset.x,
            3.0 // Move across the width
        );
    }

    // --- Vertical Lasers (Kinematic) ---
    // Moving up and down
    for (let i = 0; i < 4; i++) {
        const zPos = gridStartZ + 3 + i * 6;
        const xPos = offset.x + (i % 2 === 0 ? -2 : 2); // Stagger X positions

        game.createKinematicBox(
            { x: xPos, y: offset.y + 0.5, z: zPos },
            { x: 0.1, y: 2, z: 0.1 }, // Thin vertical laser
            [0.0, 1.0, 0.0], // Green color
            'vertical',
            offset.y + 2.0,
            1.5 // Move up and down
        );
    }

    // --- Exit Platform ---
    const exitZ = gridStartZ + gridLength + 10;
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
