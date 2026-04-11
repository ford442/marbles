import { quatFromEuler } from './math.js';

export function createMushroomBounceZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.3, 0.5, 0.2],
        'concrete'
    );

    // Mushroom 1
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: offset.z + 15 },
        floorQ,
        { x: 1, y: 3, z: 1 },
        [0.8, 0.8, 0.8],
        'wood'
    );
    game.createDynamicBox(
        { x: offset.x, y: offset.y + 1, z: offset.z + 15 },
        floorQ,
        { x: 4, y: 0.5, z: 4 },
        [0.9, 0.1, 0.1],
        0, 'wood', -1.2 // slight upward bounce
    );

    // Mushroom 2
    game.createStaticBox(
        { x: offset.x - 6, y: offset.y - 4, z: offset.z + 25 },
        floorQ,
        { x: 1.5, y: 5, z: 1.5 },
        [0.8, 0.8, 0.8],
        'wood'
    );
    game.createDynamicBox(
        { x: offset.x - 6, y: offset.y + 1, z: offset.z + 25 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.9],
        0, 'wood', -1.5
    );

    // Exit Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 40 },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.3, 0.5, 0.2],
        'concrete'
    );
}
