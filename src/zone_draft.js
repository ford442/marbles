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
export function createLaserMazeZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Maze Area ---
    const mazeStartZ = offset.z + 10;
    const mazeLength = 40;
    const mazeWidth = 20;

    // Floor underneath the maze
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: mazeStartZ + mazeLength / 2 },
        floorQ,
        { x: mazeWidth / 2, y: 0.5, z: mazeLength / 2 },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    // --- Walls (Static) ---
    // Outer walls
    game.createStaticBox(
        { x: offset.x - mazeWidth / 2, y: offset.y + 2, z: mazeStartZ + mazeLength / 2 },
        floorQ,
        { x: 0.5, y: 2, z: mazeLength / 2 },
        [0.2, 0.2, 0.2],
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + mazeWidth / 2, y: offset.y + 2, z: mazeStartZ + mazeLength / 2 },
        floorQ,
        { x: 0.5, y: 2, z: mazeLength / 2 },
        [0.2, 0.2, 0.2],
        'metal'
    );

    // --- Moving Laser Obstacles (Kinematic) ---
    // Moving lasers inside the maze
    for (let i = 0; i < 6; i++) {
        const zPos = mazeStartZ + 5 + i * 6;
        const xPos = offset.x + (Math.random() * 10 - 5);
        const yPos = offset.y + 0.6 + (i % 2 === 0 ? 0.0 : 1.0); // Stagger heights
        const moveType = i % 2 === 0 ? 'horizontal' : 'vertical';
        const amplitude = 2.0 + Math.random() * 3.0;

        game.createKinematicBox(
            { x: xPos, y: yPos, z: zPos },
            { x: moveType === 'horizontal' ? 2 : 0.1, y: moveType === 'vertical' ? 2 : 0.1, z: 0.1 },
            [1.0, 0.0, 1.0], // Magenta lasers
            moveType,
            moveType === 'horizontal' ? offset.x : offset.y + 2.0,
            amplitude
        );
    }

    // --- Exit Platform ---
    const exitZ = mazeStartZ + mazeLength + 5;
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
