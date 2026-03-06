export function createWindTunnelZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 4, y: 0.5, z: 4 },
        [0.4, 0.4, 0.4],
        'concrete'
    );

    // Tunnel Floor
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 20 },
        floorQ,
        { x: 4, y: 0.5, z: 16 },
        [0.2, 0.6, 0.8],
        'concrete'
    );

    // Tunnel Left Wall
    game.createStaticBox(
        { x: offset.x - 3.5, y: offset.y + 2, z: offset.z + 20 },
        floorQ,
        { x: 0.5, y: 2, z: 16 },
        [0.1, 0.1, 0.1],
        'concrete'
    );

    // Tunnel Right Wall
    game.createStaticBox(
        { x: offset.x + 3.5, y: offset.y + 2, z: offset.z + 20 },
        floorQ,
        { x: 0.5, y: 2, z: 16 },
        [0.1, 0.1, 0.1],
        'concrete'
    );

    // Tunnel Roof
    game.createStaticBox(
        { x: offset.x, y: offset.y + 4.5, z: offset.z + 20 },
        floorQ,
        { x: 4, y: 0.5, z: 16 },
        [0.2, 0.2, 0.2],
        'concrete'
    );

    // Rotating Obstacles (Fans)
    for (let i = 0; i < 3; i++) {
        const zPos = offset.z + 10 + (i * 10);
        game.createRotatingBox(
            { x: offset.x, y: offset.y + 2, z: zPos },
            { x: 3, y: 0.2, z: 0.5 },
            [0.8, 0.2, 0.2],
            'z', // Rotates around Z axis like a fan
            0.05 * (i % 2 === 0 ? 1 : -1),
            0,
            'metal'
        );
    }

    // Exit Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 40 },
        floorQ,
        { x: 4, y: 0.5, z: 4 },
        [0.4, 0.4, 0.4],
        'concrete'
    );
}
