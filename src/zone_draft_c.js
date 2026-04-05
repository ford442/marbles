import { quatFromEuler } from './math.js';
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
