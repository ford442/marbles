import { quatFromEuler } from './math.js';
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
