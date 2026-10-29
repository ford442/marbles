export function createCyberMatrixZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.1, 0.1, 0.15],
        'metal'
    );

    // --- Low-Friction Digital Ice Track ---
    const trackZ = offset.z + 55;
    game.createStaticBox(
        { x: offset.x, y: offset.y - 1, z: trackZ },
        floorQ,
        { x: 12, y: 0.5, z: 45 },
        [0.1, 0.9, 1.0], // Neon cyan
        'glass'
    );

    // --- Kinematic Data Packets (Moving Obstacles) ---
    const numObstacles = 4;
    for (let i = 0; i < numObstacles; i++) {
        const obsZ = offset.z + 20 + (i * 20);
        const startX = offset.x + (i % 2 === 0 ? 5 : -5);

        // createKinematicBox(pos, halfExtents, color, movingPlatformType, center, amplitude, speed = 1.0, waitTime = 0.0)
        game.createKinematicBox(
            { x: startX, y: offset.y, z: obsZ },
            { x: 3, y: 1.5, z: 3 },
            [1.0, 0.0, 0.5], // Magenta
            'horizontal',
            offset.x, // center
            10.0,      // amplitude
            2.0 + (i * 0.5) // speed
        );
    }

    // --- Exit Platform ---
    const exitZ = offset.z + 110;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.1, 0.1, 0.15],
        'metal'
    );
}
