import { quatFromEuler } from '../math.js';

export function createTrampolineParkZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Trampoline Area ---
    const parkStartZ = offset.z + 10;
    const parkLength = 50;

    // Safety net floor below everything
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5, z: parkStartZ + parkLength / 2 },
        floorQ,
        { x: 15, y: 0.5, z: parkLength / 2 + 5 },
        [0.1, 0.5, 0.1],
        'concrete'
    );

    // --- Bouncy Trampolines (Static) ---
    // High restitution boxes
    for (let i = 0; i < 5; i++) {
        const zPos = parkStartZ + i * 10;
        const xPos = offset.x + (i % 2 === 0 ? -4 : 4);

        game.createStaticBox(
            { x: xPos, y: offset.y, z: zPos },
            floorQ,
            { x: 3, y: 0.5, z: 3 },
            [1.0, 0.2, 0.8], // Pink bouncy pad
            'wood'
            // We would ideally set restitution here, but createStaticBox doesn't expose it yet.
            // We'll rely on the player's bouncy profile or powerups for now.
        );
    }

    // --- Central Moving Platforms (Kinematic) ---
    for (let i = 0; i < 4; i++) {
        const zPos = parkStartZ + 5 + i * 10;

        game.createKinematicBox(
            { x: offset.x, y: offset.y + 2, z: zPos },
            { x: 2, y: 0.5, z: 2 },
            [0.2, 0.8, 0.2], // Green platform
            'vertical',
            offset.y + 2,
            3.0 // Move up and down
        );
    }

    // --- Dynamic Bouncing Obstacles ---
    for (let i = 0; i < 8; i++) {
        const zPos = parkStartZ + Math.random() * parkLength;
        const xPos = offset.x + (Math.random() * 10 - 5);

        game.createDynamicBox(
            { x: xPos, y: offset.y + 5 + Math.random() * 5, z: zPos },
            floorQ,
            { x: 1, y: 1, z: 1 },
            [0.8, 0.8, 0.1], // Yellow blocks
            1.0,
            'wood',
            0.5 // Lower gravity so they bounce floaty
        );
    }

    // --- Exit Platform ---
    const exitZ = parkStartZ + parkLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [1.0, 0.5, 0.0] // Orange goal
    );
}
