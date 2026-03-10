export function createGrappleCourseZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Starting Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- First Void Gap & Grapple Point ---
    // Floating block high up to grapple onto
    game.createStaticBox(
        { x: offset.x, y: offset.y + 15, z: offset.z + 25 },
        floorQ,
        { x: 2, y: 2, z: 2 },
        [1.0, 0.8, 0.0], // Gold/Yellow to stand out
        'metal'
    );

    // --- Middle Platform / Checkpoint Area ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 50 },
        floorQ,
        { x: 15, y: 0.5, z: 15 },
        [0.25, 0.2, 0.2],
        'concrete'
    );

    // --- Wall Ride Section ---
    // A long gap with a high wall on one side
    const wallStartZ = offset.z + 70;

    // The wall to ride on (left side)
    game.createStaticBox(
        { x: offset.x - 8, y: offset.y + 10, z: wallStartZ + 20 },
        floorQ,
        { x: 1, y: 15, z: 25 }, // Tall and long wall
        [0.1, 0.3, 0.4],
        'concrete'
    );

    // A grapple point midway through the wall ride just in case, or for style
    game.createStaticBox(
        { x: offset.x + 8, y: offset.y + 20, z: wallStartZ + 20 },
        floorQ,
        { x: 2, y: 2, z: 2 },
        [1.0, 0.8, 0.0],
        'metal'
    );

    // --- Final Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 120 },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.2, 0.25, 0.2],
        'concrete'
    );

    // Create some floating dynamic debris for visual flair in the void
    for (let i = 0; i < 5; i++) {
        game.createDynamicBox(
            { x: offset.x + (Math.random() * 20 - 10), y: offset.y + 5 + Math.random() * 10, z: offset.z + 30 + (Math.random() * 80) },
            floorQ,
            { x: 0.5, y: 0.5, z: 0.5 },
            [0.5, 0.5, 0.5],
            1.0,
            'wood',
            0 // Zero gravity so they float
        );
    }
}
