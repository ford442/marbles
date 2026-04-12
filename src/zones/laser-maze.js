import { quatFromEuler } from '../math.js';

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
