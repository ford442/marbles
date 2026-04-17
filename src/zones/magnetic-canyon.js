import { quatFromEuler } from '../math.js';

export function createMagneticCanyonZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Icy Track Segment ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: offset.z + 20 },
        floorQ,
        { x: 4, y: 0.5, z: 15 },
        [0.6, 0.8, 1.0], // Ice color
        'ice'
    );

    // --- Hovering Magnetic Obstacles (Kinematic) ---
    for (let i = 0; i < 3; i++) {
        const zPos = offset.z + 45 + i * 10;
        game.createKinematicBox(
            { x: offset.x, y: offset.y - 2, z: zPos },
            { x: 2, y: 0.5, z: 2 },
            [0.8, 0.1, 0.9], // Purple magnetic color
            'horizontal',
            offset.x,
            6.0
        );
    }

    // --- Exit Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: offset.z + 80 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );
}
