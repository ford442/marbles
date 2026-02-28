import { quatFromEuler } from './math.js';

export function createBumperArenaZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    const arenaWidth = 15;
    const arenaLength = 15;
    const wallHeight = 2;
    const wallThickness = 1;

    // Main floor
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: arenaWidth, y: 0.5, z: arenaLength },
        [0.2, 0.4, 0.8], // Blueish floor
        'concrete'
    );

    // Walls
    // Left
    game.createStaticBox(
        { x: offset.x - arenaWidth + (wallThickness / 2), y: offset.y + (wallHeight / 2), z: offset.z },
        floorQ,
        { x: wallThickness / 2, y: wallHeight / 2, z: arenaLength },
        [0.8, 0.2, 0.2], // Red walls
        'metal'
    );
    // Right
    game.createStaticBox(
        { x: offset.x + arenaWidth - (wallThickness / 2), y: offset.y + (wallHeight / 2), z: offset.z },
        floorQ,
        { x: wallThickness / 2, y: wallHeight / 2, z: arenaLength },
        [0.8, 0.2, 0.2],
        'metal'
    );
    // Front (partially open for entrance)
    game.createStaticBox(
        { x: offset.x - arenaWidth / 2 - 2, y: offset.y + (wallHeight / 2), z: offset.z - arenaLength + (wallThickness / 2) },
        floorQ,
        { x: (arenaWidth / 2) - 2, y: wallHeight / 2, z: wallThickness / 2 },
        [0.8, 0.2, 0.2],
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + arenaWidth / 2 + 2, y: offset.y + (wallHeight / 2), z: offset.z - arenaLength + (wallThickness / 2) },
        floorQ,
        { x: (arenaWidth / 2) - 2, y: wallHeight / 2, z: wallThickness / 2 },
        [0.8, 0.2, 0.2],
        'metal'
    );

    // Back (partially open for exit to goal)
    game.createStaticBox(
        { x: offset.x - arenaWidth / 2 - 2, y: offset.y + (wallHeight / 2), z: offset.z + arenaLength - (wallThickness / 2) },
        floorQ,
        { x: (arenaWidth / 2) - 2, y: wallHeight / 2, z: wallThickness / 2 },
        [0.8, 0.2, 0.2],
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + arenaWidth / 2 + 2, y: offset.y + (wallHeight / 2), z: offset.z + arenaLength - (wallThickness / 2) },
        floorQ,
        { x: (arenaWidth / 2) - 2, y: wallHeight / 2, z: wallThickness / 2 },
        [0.8, 0.2, 0.2],
        'metal'
    );

    // Bumpers (Dynamic Boxes in center)
    const numBumpers = 8;
    const bumperRadius = 6;
    for (let i = 0; i < numBumpers; i++) {
        const angle = (i / numBumpers) * Math.PI * 2;
        const bx = offset.x + Math.cos(angle) * bumperRadius;
        const bz = offset.z + Math.sin(angle) * bumperRadius;
        const by = offset.y + 1;

        // We'll use createDynamicBox but they will act as heavy obstacles
        // Actually, let's use some kinematic or static boxes as bumpers so they don't get knocked away easily,
        // OR we can make them dynamic but very heavy.

        const q = quatFromEuler(angle, 0, 0); // Rotate to face outward

        game.createDynamicBox(
            { x: bx, y: by, z: bz },
            q,
            { x: 1, y: 1, z: 1 }, // size
            [1.0, 0.8, 0.0], // Yellowish
            5.0, // heavy density
            'wood',
            1.0
        );
    }

    // A few inner bumpers
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + (Math.PI / 4);
        const bx = offset.x + Math.cos(angle) * 3;
        const bz = offset.z + Math.sin(angle) * 3;
        const by = offset.y + 1;

        const q = quatFromEuler(angle, 0, 0);

        game.createDynamicBox(
            { x: bx, y: by, z: bz },
            q,
            { x: 0.8, y: 0.8, z: 0.8 },
            [1.0, 0.5, 0.0], // Orange
            2.0, // lighter
            'wood',
            1.0
        );
    }
}
