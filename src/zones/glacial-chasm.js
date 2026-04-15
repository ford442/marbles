
export function createGlacialChasmZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.6, 0.8, 1.0], // Light icy blue
        'glass'
    );

    const bridgeStartZ = offset.z + 10;
    const bridgeLength = 70;

    // --- Ice Bridges (Static) ---
    // Multiple narrow segments
    const segmentCount = 7;
    const segmentLength = bridgeLength / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
        const zPos = bridgeStartZ + i * segmentLength;
        // Make gaps between segments
        if (i % 2 !== 0) {
            continue;
        }

        game.createStaticBox(
            { x: offset.x, y: offset.y, z: zPos },
            floorQ,
            { x: 2.5, y: 0.2, z: segmentLength / 2 - 1.0 }, // Narrow, thin bridges
            [0.8, 0.9, 1.0], // Ice color
            'glass'
        );
    }

    // --- Moving Ice Block Obstacles (Kinematic) ---
    for (let i = 0; i < 3; i++) {
        const zPos = bridgeStartZ + 15 + i * 20;

        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos },
            { x: 4, y: 0.5, z: 0.5 },
            [0.5, 0.8, 1.0], // Darker ice blue
            'horizontal',
            offset.x,
            4.0
        );
    }
}
