import { quatFromEuler } from './math.js';

export function createPinwheelAlleyZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Starting Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.4, 0.4, 0.45],
        'concrete'
    );

    // --- First Obstacle: Windmill ---
    // A vertical rotating cross
    // game.createRotatingBox currently supports 'y' axis easily based on clockwork_zone.js,
    // let's stick to horizontal pinwheels (spinning platforms or sweeping arms).
    // Let's create a narrow path with sweeping arms.

    // Path 1
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 20 },
        floorQ,
        { x: 4, y: 0.5, z: 10 },
        [0.3, 0.3, 0.35],
        'concrete'
    );

    // Sweeping arm 1
    game.createRotatingBox(
        { x: offset.x, y: offset.y + 1, z: offset.z + 15 },
        { x: 5, y: 0.2, z: 0.5 },
        [0.8, 0.2, 0.2],
        'y',
        0.03, // Speed
        0
    );

    // Sweeping arm 2
    game.createRotatingBox(
        { x: offset.x, y: offset.y + 1, z: offset.z + 25 },
        { x: 5, y: 0.2, z: 0.5 },
        [0.8, 0.2, 0.2],
        'y',
        -0.03, // Opposite direction
        0
    );

    // --- Safe Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 35 },
        floorQ,
        { x: 8, y: 0.5, z: 5 },
        [0.4, 0.4, 0.45],
        'concrete'
    );

    // --- Second Obstacle: Stepping Pinwheels ---
    // Platforms the player has to jump across that are spinning

    // Pinwheel 1
    game.createRotatingBox(
        { x: offset.x - 5, y: offset.y + 1, z: offset.z + 45 },
        { x: 4, y: 0.2, z: 1 },
        [0.2, 0.8, 0.2],
        'y',
        0.02,
        0
    );
    game.createRotatingBox(
        { x: offset.x - 5, y: offset.y + 1, z: offset.z + 45 },
        { x: 4, y: 0.2, z: 1 },
        [0.2, 0.8, 0.2],
        'y',
        0.02,
        Math.PI / 2
    );

    // Pinwheel 2
    game.createRotatingBox(
        { x: offset.x + 5, y: offset.y + 2, z: offset.z + 55 },
        { x: 4, y: 0.2, z: 1 },
        [0.2, 0.2, 0.8],
        'y',
        -0.02,
        0
    );
    game.createRotatingBox(
        { x: offset.x + 5, y: offset.y + 2, z: offset.z + 55 },
        { x: 4, y: 0.2, z: 1 },
        [0.2, 0.2, 0.8],
        'y',
        -0.02,
        Math.PI / 2
    );

    // Pinwheel 3
    game.createRotatingBox(
        { x: offset.x, y: offset.y + 3, z: offset.z + 65 },
        { x: 4, y: 0.2, z: 1 },
        [0.8, 0.8, 0.2],
        'y',
        0.03,
        0
    );
    game.createRotatingBox(
        { x: offset.x, y: offset.y + 3, z: offset.z + 65 },
        { x: 4, y: 0.2, z: 1 },
        [0.8, 0.8, 0.2],
        'y',
        0.03,
        Math.PI / 2
    );

    // --- Final Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y + 3, z: offset.z + 80 },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.4, 0.4, 0.45],
        'concrete'
    );
}
