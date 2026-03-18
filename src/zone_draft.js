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
    // For now it's just a static box, but maybe later it could have a special material
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

    game.createGoalZone(
        { x: offset.x, y: topY + 1.0, z: offset.z + 40 },
        [1.0, 0.5, 0.0] // Orange goal
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

export function createFloatingIslandsZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.8, 0.2],
        'concrete'
    );

    // --- First Moving Island (Horizontal) ---
    game.createKinematicBox(
        { x: offset.x, y: offset.y + 2, z: offset.z + 15 },
        { x: 3, y: 0.5, z: 3 },
        [0.2, 0.6, 0.8],
        'horizontal',
        offset.x,
        5.0
    );

    // --- Second Moving Island (Vertical) ---
    game.createKinematicBox(
        { x: offset.x, y: offset.y + 4, z: offset.z + 30 },
        { x: 3, y: 0.5, z: 3 },
        [0.8, 0.6, 0.2],
        'vertical',
        offset.y + 4,
        3.0
    );

    // --- Dynamic Obstacles (Crates) on Second Island ---
    for (let i = 0; i < 3; i++) {
        game.createDynamicBox(
            { x: offset.x + (Math.random() * 2 - 1), y: offset.y + 5 + i * 1.5, z: offset.z + 30 + (Math.random() * 2 - 1) },
            floorQ,
            { x: 0.5, y: 0.5, z: 0.5 },
            [0.8, 0.4, 0.1],
            1.0,
            'wood'
        );
    }

    // --- Power-Up (Jump) on Second Island ---
    game.createPowerUp(
        { x: offset.x, y: offset.y + 5.5, z: offset.z + 30 },
        'jump'
    );

    // --- Final Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y + 6, z: offset.z + 45 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // --- Goal Zone ---
    game.createGoalZone(
        { x: offset.x, y: offset.y + 6.5, z: offset.z + 45 },
        [1.0, 0.5, 0.0]
    );
}

export function createMagnetFacilityZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.8],
        'metal'
    );

    // --- Magnetic Tunnel ---
    const tunnelZ = offset.z + 15;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: tunnelZ },
        floorQ,
        { x: 3, y: 0.5, z: 10 },
        [0.1, 0.1, 0.8],
        'metal'
    );

    // Tunnel Walls
    game.createStaticBox(
        { x: offset.x - 3, y: offset.y + 2, z: tunnelZ },
        floorQ,
        { x: 0.5, y: 2, z: 10 },
        [0.8, 0.1, 0.1],
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + 3, y: offset.y + 2, z: tunnelZ },
        floorQ,
        { x: 0.5, y: 2, z: 10 },
        [0.8, 0.1, 0.1],
        'metal'
    );

    // Tunnel Roof
    game.createStaticBox(
        { x: offset.x, y: offset.y + 4.5, z: tunnelZ },
        floorQ,
        { x: 3.5, y: 0.5, z: 10 },
        [0.1, 0.1, 0.8],
        'metal'
    );

    // --- Moving Magnetic Platforms ---
    const platZ1 = tunnelZ + 15;
    game.createKinematicBox(
        { x: offset.x - 5, y: offset.y, z: platZ1 },
        { x: 2, y: 0.5, z: 2 },
        [0.8, 0.8, 0.1],
        'horizontal',
        offset.x,
        5.0
    );

    const platZ2 = platZ1 + 10;
    game.createKinematicBox(
        { x: offset.x, y: offset.y - 3, z: platZ2 },
        { x: 2, y: 0.5, z: 2 },
        [0.8, 0.8, 0.1],
        'vertical',
        offset.y,
        3.0
    );

    // --- Goal Area ---
    const goalZ = platZ2 + 10;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: goalZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.8],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1, z: goalZ },
        [0.0, 1.0, 0.0]
    );
}

export function createLaserGridZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'metal'
    );

    // --- Main Floor (Long Grid) ---
    const gridZ = offset.z + 30;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: gridZ },
        floorQ,
        { x: 5, y: 0.5, z: 25 }, // Total length is 50, so width is 10
        [0.1, 0.1, 0.15],
        'metal'
    );

    // --- Kinematic Lasers ---
    const numLasers = 6;
    for (let i = 0; i < numLasers; i++) {
        // Space them out along the z-axis
        const lz = offset.z + 10 + i * 8;
        const startX = offset.x; // Moving across the width
        const baseY = offset.y + 0.5 + 1.0; // Slightly above ground

        // Horizontal laser beams
        game.createKinematicBox(
            { x: startX, y: baseY, z: lz },
            { x: 5, y: 0.2, z: 0.2 }, // Spanning the entire width (10 units across)
            [1.0, 0.0, 0.0], // Red color
            'horizontal', // Moves along x-axis
            startX,
            4.0 // Amplitude of movement
        );
    }

    // --- Goal Platform ---
    const goalZ = offset.z + 60;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: goalZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // Goal zone
    game.createGoalZone(
        { x: offset.x, y: offset.y + 1, z: goalZ },
        [0.0, 1.0, 0.0]
    );
}
