export function createCyberTrackZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Entrance
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    // Parallel tracks
    const trackZStart = offset.z + 5;
    const trackLength = 40;

    // Left Track
    game.createStaticBox(
        { x: offset.x - 3, y: offset.y, z: trackZStart + trackLength / 2 },
        floorQ,
        { x: 1.5, y: 0.5, z: trackLength / 2 },
        [0.1, 0.1, 0.15],
        'concrete'
    );
    // Right Track
    game.createStaticBox(
        { x: offset.x + 3, y: offset.y, z: trackZStart + trackLength / 2 },
        floorQ,
        { x: 1.5, y: 0.5, z: trackLength / 2 },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    // Laser obstacles (kinematic boxes)
    // Horizontal lasers moving across the tracks
    for (let i = 0; i < 4; i++) {
        const z = trackZStart + 5 + i * 10;

        game.createKinematicBox(
            { x: offset.x, y: offset.y + 0.6, z: z }, // slightly above track
            { x: 3, y: 0.1, z: 0.1 }, // thin laser
            [1.0, 0.0, 0.5], // neon pink
            'horizontal',
            offset.x,
            4.0 // move left/right
        );

        // Add some side rails or lights for aesthetics
        game.createStaticBox(
            { x: offset.x - 5, y: offset.y + 1, z: z },
            floorQ,
            { x: 0.2, y: 1, z: 0.2 },
            [0.0, 1.0, 1.0], // cyan
            'metal'
        );
        game.createStaticBox(
            { x: offset.x + 5, y: offset.y + 1, z: z },
            floorQ,
            { x: 0.2, y: 1, z: 0.2 },
            [0.0, 1.0, 1.0], // cyan
            'metal'
        );
    }

    // Final Ramp
    const rampZ = trackZStart + trackLength + 2.5;
    const rampAngle = -0.3;
    const sinA = Math.sin(rampAngle / 2);
    const cosA = Math.cos(rampAngle / 2);
    const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

    // Rejoin the tracks into a ramp
    game.createStaticBox(
        { x: offset.x, y: offset.y + 1, z: rampZ },
        rampQ,
        { x: 5, y: 0.5, z: 5 },
        [0.0, 1.0, 1.0], // cyan ramp
        'wood'
    );

    // Landing Platform after the jump
    const landingZ = rampZ + 15;
    game.createStaticBox(
        { x: offset.x, y: offset.y - 1, z: landingZ },
        floorQ,
        { x: 8, y: 0.5, z: 8 },
        [0.1, 0.1, 0.2],
        'concrete'
    );

    // Speed powerups at the start of the tracks
    game.createPowerUp({ x: offset.x - 3, y: offset.y + 1, z: trackZStart + 2 }, 'speed');
    game.createPowerUp({ x: offset.x + 3, y: offset.y + 1, z: trackZStart + 2 }, 'speed');
}
