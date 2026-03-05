import { quatFromEuler } from './math.js';

export function createVolcanoZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    const lavaRadius = 18;
    const lavaCenterZ = offset.z + 20;

    // Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 4, y: 0.5, z: 4 },
        [0.15, 0.15, 0.15],
        'concrete'
    );

    // Lava Floor
    game.createStaticBox(
        { x: offset.x, y: offset.y - 1.5, z: lavaCenterZ },
        floorQ,
        { x: lavaRadius, y: 0.5, z: lavaRadius },
        [1.0, 0.3, 0.0], // Glowing orange
        'concrete'
    );

    // Octagonal Caldera Walls
    const wallThickness = 1.5;
    const wallHeight = 5;
    const numSides = 8;
    const sideLength = 2 * lavaRadius * Math.tan(Math.PI / numSides) + 1.5;

    for (let i = 0; i < numSides; i++) {
        const angle = (i / numSides) * Math.PI * 2;

        // Midpoint of the wall
        const x = offset.x + Math.sin(angle) * lavaRadius;
        const z = lavaCenterZ + Math.cos(angle) * lavaRadius;

        const rotY = angle;
        const q = quatFromEuler(rotY, 0, 0);

        // Leave gaps for Entrance (angle ~PI) and Exit (angle ~0)
        // Since angle=0 is z=+radius, this is exit.
        // angle=PI is z=-radius, this is entrance.
        if (i === 0 || i === 4) {
            const gapHalfWidth = 4.5; // Total gap width 9
            const smallWallHalfExtent = (sideLength / 2 - gapHalfWidth) / 2;

            if (smallWallHalfExtent > 0) {
                const smallWallCenterOffset = gapHalfWidth + smallWallHalfExtent;

                // For walls not aligned with the global axes, we would need to shift
                // along the local X axis. Since i=0 and i=4 are aligned with X, we can just use global X.
                game.createStaticBox(
                    { x: x + smallWallCenterOffset, y: offset.y + 1, z: z },
                    q,
                    { x: smallWallHalfExtent, y: wallHeight, z: wallThickness },
                    [0.1, 0.1, 0.12],
                    'concrete'
                );
                game.createStaticBox(
                    { x: x - smallWallCenterOffset, y: offset.y + 1, z: z },
                    q,
                    { x: smallWallHalfExtent, y: wallHeight, z: wallThickness },
                    [0.1, 0.1, 0.12],
                    'concrete'
                );
            }
            continue;
        }

        game.createStaticBox(
            { x: x, y: offset.y + 1, z: z },
            q,
            { x: sideLength / 2, y: wallHeight, z: wallThickness },
            [0.1, 0.1, 0.12],
            'concrete'
        );
    }

    // Platforms over Lava

    // Rotating Platform 1 (Left side)
    game.createRotatingBox(
        { x: offset.x - 6, y: offset.y, z: lavaCenterZ - 6 },
        { x: 3, y: 0.5, z: 0.5 },
        [0.3, 0.2, 0.2],
        'y',
        0.02,
        0,
        'metal'
    );

    // Rotating Platform 2 (Right side)
    game.createRotatingBox(
        { x: offset.x + 6, y: offset.y, z: lavaCenterZ + 6 },
        { x: 3, y: 0.5, z: 0.5 },
        [0.3, 0.2, 0.2],
        'y',
        -0.03,
        Math.PI / 4,
        'metal'
    );

    // Center Stepping Stone
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: lavaCenterZ },
        floorQ,
        { x: 1.5, y: 0.5, z: 1.5 },
        [0.15, 0.15, 0.15],
        'concrete'
    );

    // Exit Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: lavaCenterZ + lavaRadius + 2 },
        floorQ,
        { x: 4, y: 0.5, z: 4 },
        [0.15, 0.15, 0.15],
        'concrete'
    );
}
