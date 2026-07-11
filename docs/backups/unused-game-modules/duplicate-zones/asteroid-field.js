import { quatFromEuler } from '../math.js';

export function createAsteroidFieldZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.4, 0.4],
        'concrete'
    );

    // --- Asteroid Field Area ---
    const fieldStartZ = offset.z + 10;
    const fieldLength = 40;

    // We don't have a floor here, so players must jump between asteroids.

    // --- Moving Asteroids (Kinematic) ---
    // We'll create several asteroids that move in various patterns.
    for (let i = 0; i < 8; i++) {
        const zPos = fieldStartZ + i * (fieldLength / 8);

        // Vary the X position
        const xPos = offset.x + (Math.random() * 10 - 5);

        // Vary the Y position (height)
        const yPos = offset.y + 1.0 + (Math.random() * 4 - 2);

        // Vary the type of movement
        const moveType = i % 2 === 0 ? 'horizontal' : 'vertical';
        const amplitude = 1.0 + Math.random() * 2.5;

        game.createKinematicBox(
            { x: xPos, y: yPos, z: zPos },
            { x: 1.5 + Math.random(), y: 0.5, z: 1.5 + Math.random() }, // Random sized platforms
            [0.3, 0.2, 0.2], // Brownish rock color
            moveType,
            moveType === 'horizontal' ? offset.x : offset.y + 1.0,
            amplitude
        );

        // Add occasional power-ups on asteroids
        if (i % 3 === 0) {
             game.createPowerUp({ x: xPos, y: yPos + 1.5, z: zPos }, 'jump');
        }
    }

    // --- Phase Wall Obstacle ---
    // A transparent wall players must phase through before the exit
    game.createPhaseBox(
        { x: offset.x, y: offset.y + 1, z: fieldStartZ + fieldLength },
        floorQ,
        { x: 10, y: 5, z: 0.5 },
        [0.8, 0.0, 1.0], // Purple glass
        'glass'
    );

    // --- Exit Platform ---
    const exitZ = fieldStartZ + fieldLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.5, 0.0, 1.0] // Purple goal
    );
}
