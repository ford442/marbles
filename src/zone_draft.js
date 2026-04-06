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

export function createMysticForestZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.2, 0.1],
        'wood'
    );

    // --- Forest Floor Area ---
    const forestStartZ = offset.z + 10;
    const forestLength = 80;
    const forestWidth = 30;

    // Dark grassy floor
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: forestStartZ + forestLength / 2 },
        floorQ,
        { x: forestWidth / 2, y: 0.5, z: forestLength / 2 },
        [0.05, 0.1, 0.05], // Very dark green
        'wood'
    );

    // --- Glowing Trees (Static Obstacles) ---
    // Cyan/Magenta glowing pillars representing magical trees
    for (let i = 0; i < 12; i++) {
        const zPos = forestStartZ + 5 + i * 6;
        const xPos = offset.x + (Math.random() * 20 - 10);
        const color = i % 2 === 0 ? [0.0, 1.0, 1.0] : [1.0, 0.0, 1.0]; // Alternating cyan and magenta

        // Tree trunk
        game.createStaticBox(
            { x: xPos, y: offset.y + 3, z: zPos },
            floorQ,
            { x: 1, y: 5, z: 1 },
            color,
            'glass'
        );

        // Sometimes spawn a jump power-up near a tree
        if (i % 4 === 0) {
            game.createPowerUp(
                { x: xPos, y: offset.y + 0.5, z: zPos - 2 },
                'jump'
            );
        }
    }

    // --- Moving Enchanted Roots (Kinematic Horizontal) ---
    // Roots that sweep across the forest floor
    for (let i = 0; i < 5; i++) {
        const zPos = forestStartZ + 15 + i * 15;
        const amplitude = 8.0 + Math.random() * 4.0;

        game.createKinematicBox(
            { x: offset.x - amplitude, y: offset.y - 0.5, z: zPos },
            { x: 3, y: 0.5, z: 0.5 },
            [0.2, 0.8, 0.2], // Glowing green roots
            'horizontal',
            offset.x,
            amplitude
        );
    }

    // --- Floating Magic Platforms (Kinematic Vertical) ---
    // Platforms that move up and down, requiring timing to cross gaps or reach higher areas
    for (let i = 0; i < 3; i++) {
        const zPos = forestStartZ + 20 + i * 20;
        const xPos = offset.x + (i % 2 === 0 ? -5 : 5);

        game.createKinematicBox(
            { x: xPos, y: offset.y + 2, z: zPos },
            { x: 2, y: 0.2, z: 2 },
            [0.8, 0.0, 1.0], // Purple magic platforms
            'vertical',
            offset.y + 2,
            4.0
        );
    }

    // --- Exit Platform ---
    const exitZ = forestStartZ + forestLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // Provide a small goal or jump point here, but the actual level goal is separate
    game.createStaticBox(
        { x: offset.x, y: offset.y + 0.5, z: exitZ + 5 },
        floorQ,
        { x: 2, y: 0.2, z: 2 },
        [0.0, 1.0, 0.5],
        'metal'
    );
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

export function createGlassBridgeZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Glass Bridge Segments ---
    const bridgeStartZ = offset.z + 10;
    const bridgeLength = 50;
    const segmentCount = 10;
    const segmentLength = bridgeLength / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
        const zPos = bridgeStartZ + i * segmentLength;
        // make every other segment missing to create jumps
        if (i % 3 === 2) {
            continue;
        }

        game.createStaticBox(
            { x: offset.x, y: offset.y, z: zPos },
            floorQ,
            { x: 3, y: 0.1, z: segmentLength / 2 - 0.5 },
            [0.8, 0.9, 1.0], // Glassy blue-ish color
            'glass'
        );
    }

    // --- Moving Obstacles (Pendulums/Sweepers) ---
    for (let i = 0; i < 3; i++) {
        const zPos = bridgeStartZ + 15 + i * 15;
        const moveType = 'horizontal';
        const amplitude = 4.0;

        game.createKinematicBox(
            { x: offset.x - amplitude, y: offset.y + 0.5, z: zPos },
            { x: 1.5, y: 0.5, z: 0.5 },
            [0.8, 0.2, 0.2], // Red sweeper
            moveType,
            offset.x,
            amplitude + Math.random() * 2.0
        );
    }

    // --- Exit Platform ---
    const exitZ = bridgeStartZ + bridgeLength + 5;
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

export function createBounceHouseZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Bounce House Area ---
    const houseStartZ = offset.z + 10;
    const houseLength = 30;

    // Floor of the bounce house
    game.createStaticBox(
        { x: offset.x, y: offset.y - 0.5, z: houseStartZ + houseLength / 2 },
        floorQ,
        { x: 10, y: 0.5, z: houseLength / 2 },
        [0.8, 0.1, 0.8],
        'metal'
    );

    // Bouncy platforms inside
    for (let i = 0; i < 4; i++) {
        const zPos = houseStartZ + 5 + i * 7;
        game.createDynamicBox(
            { x: offset.x + (i % 2 === 0 ? -3 : 3), y: offset.y + 0.5, z: zPos },
            floorQ,
            { x: 2, y: 0.5, z: 2 },
            [0.1, 0.8, 0.1],
            0, // static dynamic box
            'wood',
            -1.5 // some custom bouncy logic might need to apply restitution later, or we use negative gravity if applicable
        );
    }

    // Walls
    game.createStaticBox(
        { x: offset.x - 10, y: offset.y + 2, z: houseStartZ + houseLength / 2 },
        floorQ,
        { x: 0.5, y: 3, z: houseLength / 2 },
        [0.1, 0.5, 0.8],
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + 10, y: offset.y + 2, z: houseStartZ + houseLength / 2 },
        floorQ,
        { x: 0.5, y: 3, z: houseLength / 2 },
        [0.1, 0.5, 0.8],
        'metal'
    );

    // 2 Kinetic obstacles
    game.createKinematicBox(
        { x: offset.x, y: offset.y + 1, z: houseStartZ + 10 },
        { x: 4, y: 0.5, z: 1 },
        [0.9, 0.9, 0.1],
        'horizontal',
        offset.x,
        4.0
    );

    game.createKinematicBox(
        { x: offset.x, y: offset.y + 1, z: houseStartZ + 20 },
        { x: 4, y: 0.5, z: 1 },
        [0.9, 0.9, 0.1],
        'horizontal',
        offset.x,
        4.0
    );

    // --- Exit Platform ---
    const exitZ = houseStartZ + houseLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [1.0, 0.0, 1.0]
    );
}

export function createPendulumBridgeZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.4, 0.45],
        'concrete'
    );

    // --- The Bridge ---
    const bridgeStartZ = offset.z + 10;
    const bridgeLength = 60;

    // Narrow bridge for the player to cross
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: bridgeStartZ + bridgeLength / 2 - 5 },
        floorQ,
        { x: 1.5, y: 0.5, z: bridgeLength / 2 },
        [0.6, 0.5, 0.4],
        'wood'
    );

    // --- Pendulums / Sweepers ---
    // Moving kinematic boxes that swing across the bridge
    const numPendulums = 5;
    for (let i = 0; i < numPendulums; i++) {
        const zPos = bridgeStartZ + 5 + i * 10;

        // Stagger the movement
        const amplitude = 4.0;

        // createKinematicBox(pos, halfExtents, color, type, center, amplitude)
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos },
            { x: 2, y: 0.5, z: 0.5 }, // Wide sweeper
            [0.8, 0.2, 0.1], // Danger Red
            'horizontal',
            offset.x,
            amplitude + Math.random() // slightly different speeds/amplitudes
        );
    }

    // --- Power-Up (Speed) ---
    // Give player a chance to sprint across
    game.createPowerUp(
        { x: offset.x, y: offset.y + 1.5, z: bridgeStartZ + 25 },
        'speed'
    );

    // --- Exit Platform ---
    const exitZ = bridgeStartZ + bridgeLength;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.2, 0.8, 0.2] // Green goal
    );
}

export function createSpiralTowerZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Central Spire ---
    const towerRadius = 4.0;
    const towerHeight = 30.0;
    const towerCenterZ = offset.z + 20.0;
    game.createStaticBox(
        { x: offset.x, y: offset.y + towerHeight / 2 - 2, z: towerCenterZ },
        floorQ,
        { x: towerRadius, y: towerHeight / 2 + 2, z: towerRadius },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    // --- Spiral Track ---
    const numSteps = 40;
    const stepHeight = 0.8;
    const angleStep = Math.PI / 6; // 30 degrees per step
    const platformWidth = 3.0;
    const platformDepth = 2.0;
    const platformRadius = towerRadius + platformDepth;

    for (let i = 0; i < numSteps; i++) {
        const angle = i * angleStep;
        const yPos = offset.y + i * stepHeight + 1.0;

        const xPos = offset.x + Math.sin(angle) * platformRadius;
        const zPos = towerCenterZ + Math.cos(angle) * platformRadius;

        // Quat to align the platform tangentially or radially
        // We want the platform to face the center, so rotate around Y axis
        const qY = Math.sin(angle / 2);
        const qW = Math.cos(angle / 2);
        const q = { x: 0, y: qY, z: 0, w: qW };

        // For simple stepping stones, we can just use floorQ if we make them roughly square
        game.createStaticBox(
            { x: xPos, y: yPos, z: zPos },
            q,
            { x: platformWidth / 2, y: 0.2, z: platformDepth / 2 },
            [0.2, 0.6, 0.8], // Cyan-ish steps
            'concrete'
        );

        // Add some power-ups or obstacles occasionally
        if (i > 5 && i % 8 === 0) {
            game.createPowerUp(
                { x: xPos, y: yPos + 1.0, z: zPos },
                'jump'
            );
        } else if (i > 5 && i % 5 === 0) {
            // Kinematic obstacle moving up and down
            game.createKinematicBox(
                { x: xPos, y: yPos + 1.5, z: zPos },
                { x: platformWidth / 2 - 0.2, y: 0.2, z: 0.2 },
                [1.0, 0.2, 0.2], // Red danger
                'vertical',
                yPos + 1.5,
                1.5
            );
        }
    }

    // --- Exit Platform ---
    const topY = offset.y + numSteps * stepHeight;
    const exitAngle = numSteps * angleStep;
    const exitX = offset.x + Math.sin(exitAngle) * (platformRadius + 5.0);
    const exitZ = towerCenterZ + Math.cos(exitAngle) * (platformRadius + 5.0);

    game.createStaticBox(
        { x: exitX, y: topY, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: exitX, y: topY + 1.0, z: exitZ },
        [1.0, 0.8, 0.0] // Gold goal
    );
}

export function createNeonTrackZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    // --- Main Neon Track ---
    const trackStartZ = offset.z + 10;
    const trackLength = 40;
    const trackWidth = 8;

    // Track Floor
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: trackStartZ + trackLength / 2 },
        floorQ,
        { x: trackWidth / 2, y: 0.5, z: trackLength / 2 },
        [0.05, 0.05, 0.1], // Dark floor
        'concrete'
    );

    // Neon Side Bumpers
    game.createStaticBox(
        { x: offset.x - trackWidth / 2, y: offset.y + 1, z: trackStartZ + trackLength / 2 },
        floorQ,
        { x: 0.5, y: 1, z: trackLength / 2 },
        [0.0, 1.0, 1.0], // Cyan neon glow
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + trackWidth / 2, y: offset.y + 1, z: trackStartZ + trackLength / 2 },
        floorQ,
        { x: 0.5, y: 1, z: trackLength / 2 },
        [1.0, 0.0, 1.0], // Magenta neon glow
        'metal'
    );

    // --- Moving Neon Gates (Kinematic) ---
    for (let i = 0; i < 3; i++) {
        const gateZ = trackStartZ + 10 + i * 10;

        // Horizontal moving bar to block path
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: gateZ },
            { x: trackWidth / 2 - 1, y: 0.5, z: 0.5 },
            [1.0, 1.0, 0.0], // Yellow gate
            'horizontal',
            offset.x,
            2.0 // Amplitude
        );
    }

    // --- Power-Up (Speed) ---
    game.createPowerUp(
        { x: offset.x, y: offset.y + 1.5, z: trackStartZ + 20 },
        'speed'
    );

    // --- Exit Platform ---
    const exitZ = trackStartZ + trackLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.0, 1.0, 0.5] // Greenish goal
    );
}

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

export function createCannonVolleyZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- The Bridge ---
    const bridgeStartZ = offset.z + 10;
    const bridgeLength = 60;

    // Narrow bridge for the player to cross
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: bridgeStartZ + bridgeLength / 2 - 5 },
        floorQ,
        { x: 1.5, y: 0.5, z: bridgeLength / 2 },
        [0.6, 0.5, 0.4],
        'wood'
    );

    // --- Cannon Volleys / Sweepers ---
    // Moving kinematic boxes that shoot across the bridge
    const numCannons = 6;
    for (let i = 0; i < numCannons; i++) {
        const zPos = bridgeStartZ + 5 + i * 8;

        // Stagger the movement
        const amplitude = 5.0;

        // createKinematicBox(pos, halfExtents, color, type, center, amplitude)
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 0.5, z: zPos },
            { x: 0.5, y: 0.5, z: 0.5 }, // Cannonball
            [0.1, 0.1, 0.1], // Dark Iron
            'horizontal',
            offset.x,
            amplitude + Math.random() // slightly different speeds/amplitudes
        );
    }

    // --- Exit Platform ---
    const exitZ = bridgeStartZ + bridgeLength;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.8, 0.2, 0.2] // Red goal
    );
}

export function createCrystalCavernZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Cavern Area ---
    const cavernStartZ = offset.z + 10;
    const cavernLength = 60;
    const cavernWidth = 20;

    // Floor of the cavern
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: cavernStartZ + cavernLength / 2 },
        floorQ,
        { x: cavernWidth / 2, y: 0.5, z: cavernLength / 2 },
        [0.4, 0.1, 0.6], // Glassy purple
        'glass'
    );

    // --- Crystal Pillars (Static) ---
    // Cyan static obstacles
    for (let i = 0; i < 6; i++) {
        const zPos = cavernStartZ + 5 + i * 10;
        const xPos = offset.x + (i % 2 === 0 ? -4 : 4);

        game.createStaticBox(
            { x: xPos, y: offset.y + 3, z: zPos },
            floorQ,
            { x: 1, y: 5, z: 1 },
            [0.0, 1.0, 1.0], // Cyan crystal
            'glass'
        );
    }

    // --- Moving Crystal Platforms (Kinematic) ---
    // Horizontal moving glowing pink platforms
    for (let i = 0; i < 4; i++) {
        const zPos = cavernStartZ + 10 + i * 12;

        game.createKinematicBox(
            { x: offset.x, y: offset.y + 0.5, z: zPos },
            { x: 2, y: 0.5, z: 2 },
            [1.0, 0.0, 0.8], // Glowing pink
            'horizontal',
            offset.x,
            4.0
        );
    }

    // --- Power-Up (Jump) ---
    game.createPowerUp(
        { x: offset.x, y: offset.y + 1.0, z: cavernStartZ + 30 },
        'jump'
    );

    // --- Exit Platform ---
    const exitZ = cavernStartZ + cavernLength + 5;
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

export function createSpaceElevatorZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Elevator Shaft Walls ---
    const shaftStartZ = offset.z + 10;
    const shaftHeight = 60;
    const shaftWidth = 12;
    const shaftDepth = 12;

    // We leave the front and back partially open or closed. Let's make an open framework.
    const pillarColors = [0.3, 0.3, 0.4];

    // Four corner pillars
    game.createStaticBox(
        { x: offset.x - shaftWidth/2, y: offset.y + shaftHeight/2, z: shaftStartZ - shaftDepth/2 },
        floorQ,
        { x: 1, y: shaftHeight/2, z: 1 },
        pillarColors,
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + shaftWidth/2, y: offset.y + shaftHeight/2, z: shaftStartZ - shaftDepth/2 },
        floorQ,
        { x: 1, y: shaftHeight/2, z: 1 },
        pillarColors,
        'metal'
    );
    game.createStaticBox(
        { x: offset.x - shaftWidth/2, y: offset.y + shaftHeight/2, z: shaftStartZ + shaftDepth/2 },
        floorQ,
        { x: 1, y: shaftHeight/2, z: 1 },
        pillarColors,
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + shaftWidth/2, y: offset.y + shaftHeight/2, z: shaftStartZ + shaftDepth/2 },
        floorQ,
        { x: 1, y: shaftHeight/2, z: 1 },
        pillarColors,
        'metal'
    );

    // --- Moving Elevator Platforms (Vertical Kinematic) ---
    // Platforms moving up and down the shaft
    for (let i = 0; i < 4; i++) {
        // Stagger them
        const baseY = offset.y + 10 + i * 12;

        game.createKinematicBox(
            { x: offset.x + (i % 2 === 0 ? -2 : 2), y: baseY, z: shaftStartZ },
            { x: 3, y: 0.5, z: 3 },
            [0.2, 0.8, 0.8], // Cyan platforms
            'vertical',
            baseY,
            8.0 // Amplitude
        );
    }

    // --- Horizontal Obstacle Sweepers (Kinematic) ---
    // Moving back and forth across the shaft
    for (let i = 0; i < 5; i++) {
        const yPos = offset.y + 15 + i * 10;

        game.createKinematicBox(
            { x: offset.x, y: yPos, z: shaftStartZ + (i % 2 === 0 ? -2 : 2) },
            { x: 4, y: 0.5, z: 0.5 },
            [0.9, 0.2, 0.1], // Red sweeper
            'horizontal',
            offset.x,
            4.0 // Amplitude
        );
    }

    // --- Exit Platform at the Top ---
    const topY = offset.y + shaftHeight;
    const exitZ = shaftStartZ + shaftDepth + 5;

    // Bridge from top of shaft to exit
    game.createStaticBox(
        { x: offset.x, y: topY, z: shaftStartZ + shaftDepth/2 + 2.5 },
        floorQ,
        { x: 2, y: 0.5, z: 2.5 },
        [0.4, 0.4, 0.45],
        'concrete'
    );

    game.createStaticBox(
        { x: offset.x, y: topY, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: topY + 1.0, z: exitZ },
        [1.0, 0.84, 0.0] // Gold goal
    );
}

export function createDesertRuinsZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.7, 0.5], // Sandy color
        'concrete'
    );

    const ruinsStartZ = offset.z + 10;
    const ruinsLength = 70;

    // --- Sandy Floor ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: ruinsStartZ + ruinsLength / 2 },
        floorQ,
        { x: 15, y: 0.5, z: ruinsLength / 2 },
        [0.9, 0.8, 0.6], // Sand
        'concrete'
    );

    // --- Static Stone Pillars ---
    for (let i = 0; i < 6; i++) {
        const zPos = ruinsStartZ + 5 + i * 12;
        const xPos = offset.x + (i % 2 === 0 ? -6 : 6);
        game.createStaticBox(
            { x: xPos, y: offset.y + 4, z: zPos },
            floorQ,
            { x: 2, y: 6, z: 2 },
            [0.6, 0.5, 0.4], // Stone
            'concrete'
        );
    }

    // --- Falling Blocks (Dynamic) ---
    for (let i = 0; i < 4; i++) {
        const zPos = ruinsStartZ + 15 + i * 15;
        const xPos = offset.x + (Math.random() * 8 - 4);
        game.createDynamicBox(
            { x: xPos, y: offset.y + 15 + Math.random() * 5, z: zPos },
            floorQ,
            { x: 1.5, y: 1.5, z: 1.5 },
            [0.7, 0.6, 0.5], // Sandstone block
            2.0,
            'concrete'
        );
    }

    // --- Moving Kinematic Sandstone Platforms ---
    for (let i = 0; i < 3; i++) {
        const zPos = ruinsStartZ + 10 + i * 20;
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos },
            { x: 3, y: 0.5, z: 3 },
            [0.8, 0.7, 0.5], // Sandstone
            'horizontal',
            offset.x,
            5.0
        );
    }

    // --- Exit Platform ---
    const exitZ = ruinsStartZ + ruinsLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.7, 0.5],
        'concrete'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [1.0, 0.8, 0.0] // Gold goal
    );
}

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

export function createNeonGridZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.9, 0.1],
        'glass'
    );

    // --- Main Floor Area ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: offset.z + 30 },
        floorQ,
        { x: 10, y: 0.5, z: 20 },
        [0.05, 0.05, 0.1],
        'metal'
    );

    // --- Moving Kinematic Walls ---
    game.createKinematicBox(
        { x: offset.x, y: offset.y + 1, z: offset.z + 20 },
        { x: 3, y: 1.5, z: 0.5 },
        [1.0, 0.0, 0.8],
        'horizontal',
        offset.x,
        6.0
    );

    game.createKinematicBox(
        { x: offset.x, y: offset.y + 1, z: offset.z + 40 },
        { x: 3, y: 1.5, z: 0.5 },
        [0.0, 1.0, 1.0],
        'horizontal',
        offset.x,
        -6.0
    );

    // --- Exit Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 60 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.9, 0.1],
        'glass'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: offset.z + 60 },
        [0.2, 0.9, 0.2]
    );
}

export function createIceBridgesZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.6, 0.8, 1.0], // Light icy blue
        'glass'
    );

    const bridgeStartZ = offset.z + 10;
    const bridgeLength = 60;

    // --- Ice Bridges (Static) ---
    // Multiple narrow segments
    const segmentCount = 6;
    const segmentLength = bridgeLength / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
        const zPos = bridgeStartZ + i * segmentLength;
        // Make gaps between segments
        if (i % 2 !== 0) {
            continue;
        }

        game.createStaticBox(
            { x: offset.x, y: offset.y, z: zPos },
            floorQ,
            { x: 1.5, y: 0.2, z: segmentLength / 2 - 1.0 }, // Narrow, thin bridges
            [0.8, 0.9, 1.0], // Ice color
            'glass'
        );
    }

    // --- Spinning Ice Obstacles (Kinematic) ---
    for (let i = 0; i < 3; i++) {
        const zPos = bridgeStartZ + 15 + i * 20;

        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos },
            { x: 4, y: 0.5, z: 0.5 },
            [0.5, 0.8, 1.0], // Darker ice blue
            'horizontal',
            offset.x,
            4.0
        );
    }

    // --- Exit Platform ---
    const exitZ = bridgeStartZ + bridgeLength;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.6, 0.8, 1.0],
        'glass'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.0, 1.0, 1.0] // Cyan goal
    );
}

export function createJungleRunZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.6, 0.4],
        'wood'
    );

    // --- Water Floor ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5, z: offset.z + 30 },
        floorQ,
        { x: 15, y: 0.5, z: 30 },
        [0.0, 0.5, 0.8],
        'glass'
    );

    // --- Kinematic Swinging Logs ---
    for (let i = 0; i < 3; i++) {
        game.createKinematicBox(
            { x: offset.x - 4, y: offset.y + 1, z: offset.z + 10 + i * 15 },
            { x: 3, y: 0.5, z: 0.5 },
            [0.5, 0.3, 0.1],
            'horizontal',
            offset.x,
            4.0
        );
    }

    // --- Exit Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 65 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.6, 0.4],
        'wood'
    );

    // --- Goal ---
    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: offset.z + 65 },
        [0.0, 1.0, 0.0]
    );
}
