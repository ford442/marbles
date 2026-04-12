import { quatFromEuler } from '../math.js';

export function createStarlightAscentZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.4],
        'concrete'
    );

    const ascentStartZ = offset.z + 10;
    const ascentLength = 80;

    // --- Ascending Glowing Platforms ---
    const numPlatforms = 10;
    for (let i = 0; i < numPlatforms; i++) {
        const zPos = ascentStartZ + i * 8;
        const xPos = offset.x + (i % 2 === 0 ? -3 : 3);
        const yPos = offset.y + i * 2;

        game.createStaticBox(
            { x: xPos, y: yPos, z: zPos },
            floorQ,
            { x: 2, y: 0.5, z: 2 },
            [0.5 + Math.random() * 0.5, 0.8, 1.0], // Glowing starlight colors
            'glass'
        );
    }

    // --- Kinematic Sweeper Obstacles ---
    for (let i = 0; i < 4; i++) {
        const zPos = ascentStartZ + 15 + i * 16;
        const yPos = offset.y + 1 + (i * 4); // Match the approximate height of platforms

        game.createKinematicBox(
            { x: offset.x, y: yPos, z: zPos },
            { x: 5, y: 0.5, z: 0.5 },
            [1.0, 0.8, 0.2], // Gold/yellow sweeper
            'horizontal',
            offset.x,
            4.0
        );
    }

    // --- Final Exit Platform ---
    const exitY = offset.y + (numPlatforms - 1) * 2;
    const exitZ = ascentStartZ + (numPlatforms - 1) * 8 + 10;

    game.createStaticBox(
        { x: offset.x, y: exitY, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: exitY + 1.0, z: exitZ },
        [1.0, 1.0, 0.8] // Starlight goal
    );
}
