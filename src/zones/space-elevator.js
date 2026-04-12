import { quatFromEuler } from '../math.js';

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
