import { quatFromEuler } from '../math.js';

export function createFrostbiteCavernZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.9, 1.0], // Ice white/blue
        'ice'
    );

    const cavernZ = offset.z + 10;

    // Angled Ice Slide
    const slideAngle = 0.2;
    const slideQ = quatFromEuler(slideAngle, 0, 0);
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: cavernZ + 10 },
        slideQ,
        { x: 4, y: 0.5, z: 12 },
        [0.6, 0.8, 1.0], // Deep ice blue
        'ice'
    );

    // Kinematic Ice Floes (moving horizontally)
    for (let i = 0; i < 4; i++) {
        const zPos = cavernZ + 25 + i * 8;
        game.createKinematicBox(
            { x: offset.x, y: offset.y - 4, z: zPos },
            { x: 2, y: 0.5, z: 2 },
            [0.7, 0.9, 1.0],
            'horizontal',
            offset.x,
            5.0
        );
    }

    // Exit Platform
    const exitZ = cavernZ + 55;
    game.createStaticBox(
        { x: offset.x, y: offset.y - 4, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.9, 1.0],
        'ice'
    );
}
