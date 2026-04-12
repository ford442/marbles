import { quatFromEuler } from '../math.js';

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
