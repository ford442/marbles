import { quatFromEuler } from '../math.js';
import { createZoneLight } from './methods/visuals.js';

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

    // --- Dynamic Neon Tube Lights ---
    // Hot magenta accent from the left kinematic wall
    createZoneLight(game, 'POINT',
        { x: offset.x - 6, y: offset.y + 2, z: offset.z + 20 },
        [1.0, 0.0, 0.85], 60000.0, 14.0);

    // Cyan accent from the right kinematic wall
    createZoneLight(game, 'POINT',
        { x: offset.x + 6, y: offset.y + 2, z: offset.z + 40 },
        [0.0, 1.0, 1.0], 60000.0, 14.0);

    // Green grid-floor underlighting
    createZoneLight(game, 'POINT',
        { x: offset.x, y: offset.y - 1, z: offset.z + 30 },
        [0.1, 1.0, 0.3], 40000.0, 20.0);
}
