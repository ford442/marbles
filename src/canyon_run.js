import { quatFromEuler } from './math.js';

export const canyonRunLevel = {
    name: 'Canyon Run',
    description: 'Navigate the treacherous canyon path!',
    zones: [
        { type: 'canyon_run', pos: { x: 0, y: 0, z: 0 } },
        { type: 'goal', pos: { x: 0, y: -2, z: 80 } }
    ],
    spawn: { x: 0, y: 5, z: -10 },
    goals: [
        { id: 1, range: { x: [-3, 3], z: [78, 82], y: [-5, 0] } }
    ],
    camera: { mode: 'follow', height: 10, offset: -15 },
    nightMode: false
};

export function createCanyonRunZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Base Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.6, 0.4, 0.2], // Brownish canyon rock
        'concrete'
    );

    // --- Canyon Walls ---
    // Left Wall
    game.createStaticBox(
        { x: offset.x - 6, y: offset.y + 10, z: offset.z + 40 },
        floorQ,
        { x: 2, y: 15, z: 50 },
        [0.5, 0.3, 0.2], // Slightly darker rock
        'concrete'
    );

    // Right Wall
    game.createStaticBox(
        { x: offset.x + 6, y: offset.y + 10, z: offset.z + 40 },
        floorQ,
        { x: 2, y: 15, z: 50 },
        [0.5, 0.3, 0.2],
        'concrete'
    );

    // --- Narrow Path / Bridge ---
    // Section 1: Slanted down
    const qSlant1 = quatFromEuler(0, -0.1, 0); // Pitch down slightly
    game.createStaticBox(
        { x: offset.x, y: offset.y - 1, z: offset.z + 20 },
        qSlant1,
        { x: 2, y: 0.2, z: 10 },
        [0.7, 0.5, 0.3], // Lighter path
        'wood'
    );

    // Section 2: Gap
    // There's a 5 unit gap here from z: 30 to z: 35

    // Section 3: Slanted up, very narrow
    const qSlant2 = quatFromEuler(0, 0.1, 0); // Pitch up
    game.createStaticBox(
        { x: offset.x, y: offset.y - 1.5, z: offset.z + 45 },
        qSlant2,
        { x: 1, y: 0.2, z: 10 },
        [0.7, 0.5, 0.3],
        'wood'
    );

    // --- Dynamic Obstacles (Rocks) ---
    for (let i = 0; i < 5; i++) {
        game.createDynamicBox(
            { x: offset.x + (Math.random() * 4 - 2), y: offset.y + 5 + i * 2, z: offset.z + 40 + (Math.random() * 10 - 5) },
            floorQ,
            { x: 0.5 + Math.random() * 0.5, y: 0.5 + Math.random() * 0.5, z: 0.5 + Math.random() * 0.5 },
            [0.4, 0.4, 0.4],
            1.5, // Density
            'concrete'
        );
    }

    // --- Final Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: offset.z + 65 },
        floorQ,
        { x: 8, y: 0.5, z: 10 },
        [0.6, 0.4, 0.2],
        'concrete'
    );
}
