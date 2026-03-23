import { quatFromEuler } from './math.js';

export function createVolcanoZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Lava Floor (Hazard/Reset) ---
    // Make it wide and glowing (red/orange)
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5, z: offset.z + 40 },
        floorQ,
        { x: 40, y: 0.5, z: 40 },
        [1.0, 0.2, 0.0],
        'concrete'
    );

    // --- Caldera Walls ---
    // Create an octagonal rim
    const calderaRadius = 35;
    const wallHeight = 15;
    const numWalls = 8;
    for (let i = 0; i < numWalls; i++) {
        const angle = (i / numWalls) * Math.PI * 2;
        const x = offset.x + Math.sin(angle) * calderaRadius;
        const z = offset.z + 40 + Math.cos(angle) * calderaRadius;
        const q = quatFromEuler(angle, 0, 0);

        game.createStaticBox(
            { x: x, y: offset.y + wallHeight/2 - 5, z: z },
            q,
            { x: 15, y: wallHeight/2, z: 2 },
            [0.15, 0.1, 0.1],
            'concrete'
        );
    }

    // --- Floating Rock Platforms (Kinematic) ---
    const platformRadius = 25;
    const numPlatforms = 12;
    for (let i = 0; i < numPlatforms; i++) {
        const angle = (i / numPlatforms) * Math.PI * 2;
        const dist = 10 + Math.random() * platformRadius;
        const x = offset.x + Math.sin(angle) * dist;
        const z = offset.z + 40 + Math.cos(angle) * dist;
        const baseY = offset.y + (i * 1.5); // Ascending spiraling platforms

        // Vary the type of movement
        const moveType = i % 3 === 0 ? 'vertical' : (i % 3 === 1 ? 'horizontal' : 'depth');
        const amplitude = 1.0 + Math.random() * 2.0;

        game.createKinematicBox(
            { x: x, y: baseY, z: z },
            { x: 2.5, y: 0.5, z: 2.5 },
            [0.3, 0.25, 0.2], // Dark rock color
            moveType,
            moveType === 'vertical' ? baseY : (moveType === 'horizontal' ? x : z),
            amplitude
        );

        // Add occasional power-ups on platforms
        if (i % 4 === 0) {
             game.createPowerUp({ x: x, y: baseY + 1.0, z: z }, 'jump');
        }
    }

    // --- Central Spire ---
    game.createStaticBox(
        { x: offset.x, y: offset.y + 10, z: offset.z + 40 },
        floorQ,
        { x: 3, y: 15, z: 3 },
        [0.1, 0.05, 0.05],
        'concrete'
    );

    // --- Goal at the Top ---
    const topY = offset.y + 25.5;
    game.createStaticBox(
        { x: offset.x, y: topY, z: offset.z + 40 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // --- Erupting Debris (Dynamic Objects) ---
    for (let j = 0; j < 10; j++) {
        // Randomly spawn these high up, they will fall and bounce
        const dx = offset.x + (Math.random() * 20 - 10);
        const dz = offset.z + 40 + (Math.random() * 20 - 10);
        const dy = topY + 10 + (Math.random() * 30);

        game.createDynamicBox(
            { x: dx, y: dy, z: dz },
            floorQ,
            { x: 0.8, y: 0.8, z: 0.8 }, // Size of debris
            [0.9, 0.3, 0.1], // Glowing orange/red color
            3.0, // High density
            'concrete' // Material
        );
    }
}
