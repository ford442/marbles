import { quatFromEuler } from '../math.js';

export function createLavaTubesZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // Lava Floor
    const tubeStartZ = offset.z + 10;
    const tubeLength = 60;
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5, z: tubeStartZ + tubeLength / 2 },
        floorQ,
        { x: 15, y: 0.5, z: tubeLength / 2 },
        [1.0, 0.2, 0.0],
        'glass'
    );

    // Tube Segments (Static)
    for (let i = 0; i < 4; i++) {
        const zPos = tubeStartZ + 5 + i * 15;
        game.createStaticBox(
            { x: offset.x, y: offset.y, z: zPos },
            floorQ,
            { x: 3, y: 0.5, z: 4 },
            [0.3, 0.3, 0.35],
            'metal'
        );
    }

    // Kinematic Sweepers
    for (let i = 0; i < 3; i++) {
        const zPos = tubeStartZ + 12 + i * 15;
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 2, z: zPos },
            { x: 4, y: 0.5, z: 1 },
            [1.0, 0.5, 0.0],
            'vertical',
            offset.y + 2,
            4.0
        );
    }

    // Exit Platform
    const exitZ = tubeStartZ + tubeLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [1.0, 0.0, 0.0] // Red goal
    );
}
