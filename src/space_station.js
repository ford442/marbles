// Space Station Level Module

export const spaceStationLevel = {
    name: 'Space Station',
    description: 'Zero-G environment with artificial gravity',
    zones: [
        { type: 'space_station', pos: { x: 0, y: 0, z: 0 } },
        { type: 'goal', pos: { x: 0, y: 2, z: 105 } }
    ],
    spawn: { x: 0, y: 2, z: -5 },
    goals: [
        { id: 1, range: { x: [-3, 3], z: [103, 107], y: [0, 5] } }
    ],
    camera: { mode: 'follow', height: 12, offset: -20 },
    nightMode: true,
    backgroundColor: [0.0, 0.0, 0.0, 1.0]
};

export function createSpaceStationZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Docking Bay (Start) ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 8, y: 0.5, z: 8 },
        [0.5, 0.5, 0.6], // Grey-blue metal
        'metal'
    );

    // Walls for Docking Bay
    game.createStaticBox({ x: offset.x - 7.5, y: offset.y + 2, z: offset.z }, floorQ, { x: 0.5, y: 2, z: 8 }, [0.4, 0.4, 0.5], 'metal');
    game.createStaticBox({ x: offset.x + 7.5, y: offset.y + 2, z: offset.z }, floorQ, { x: 0.5, y: 2, z: 8 }, [0.4, 0.4, 0.5], 'metal');

    // --- Corridor 1 ---
    // Narrow bridge
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 18 },
        floorQ,
        { x: 2, y: 0.5, z: 10 },
        [0.6, 0.6, 0.7],
        'metal'
    );

    // Solar Panel Wings
    const panelColor = [0.1, 0.1, 0.9];
    game.createStaticBox(
        { x: offset.x + 8, y: offset.y, z: offset.z + 18 },
        { x: 0, y: 0, z: -0.2, w: 0.98 },
        { x: 4, y: 0.1, z: 8 },
        panelColor,
        'glass'
    );
    game.createStaticBox(
        { x: offset.x - 8, y: offset.y, z: offset.z + 18 },
        { x: 0, y: 0, z: 0.2, w: 0.98 },
        { x: 4, y: 0.1, z: 8 },
        panelColor,
        'glass'
    );

    // --- Central Hub (Spinning Ring Simulation) ---
    // A large circular platform
    const hubZ = offset.z + 40;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: hubZ },
        floorQ,
        { x: 6, y: 0.5, z: 6 },
        [0.7, 0.7, 0.8],
        'metal'
    );

    // "Rotating" arms (static but angled)
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const dist = 10;
        const x = offset.x + Math.sin(angle) * dist;
        const z = hubZ + Math.cos(angle) * dist;

        game.createStaticBox(
            { x: x, y: offset.y + 2, z: z },
            floorQ,
            { x: 3, y: 0.5, z: 3 },
            [0.5, 0.5, 0.6],
            'metal'
        );

        // Connectors
        const cx = offset.x + Math.sin(angle) * 5;
        const cz = hubZ + Math.cos(angle) * 5;
         game.createStaticBox(
            { x: cx, y: offset.y + 1, z: cz },
             { x: 0, y: Math.sin(angle/2), z: 0, w: Math.cos(angle/2) },
            { x: 0.5, y: 0.5, z: 4 },
            [0.4, 0.4, 0.5],
            'metal'
        );
    }

    // --- Zero-G Debris Field ---
    // Dynamic boxes with 0 gravity floating around the path
    const fieldZ = hubZ + 25;

    // Path through debris
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: fieldZ },
        floorQ,
        { x: 2, y: 0.5, z: 15 },
        [0.3, 0.3, 0.3], // Dark path
        'metal'
    );

    for (let i = 0; i < 15; i++) {
        const dx = (Math.random() - 0.5) * 20;
        const dy = (Math.random() - 0.5) * 10 + 5; // Float above
        const dz = (Math.random() - 0.5) * 30 + fieldZ;

        const rot = {
            x: Math.random(),
            y: Math.random(),
            z: Math.random(),
            w: Math.random()
        };

        // Random sizes
        const sx = 0.5 + Math.random();
        const sy = 0.5 + Math.random();
        const sz = 0.5 + Math.random();

        game.createDynamicBox(
            { x: offset.x + dx, y: offset.y + dy, z: dz },
            rot,
            { x: sx, y: sy, z: sz },
            [0.6, 0.6, 0.65], // Debris color
            0.5, // Density
            'metal',
            0.0 // Zero Gravity!
        );
    }

    // --- Final Goal Platform ---
    const goalZ = fieldZ + 25;
    game.createStaticBox(
        { x: offset.x, y: offset.y + 2, z: goalZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // Ramp up to it
    game.createStaticBox(
        { x: offset.x, y: offset.y + 1, z: goalZ - 8 },
        { x: Math.sin(-0.2), y: 0, z: 0, w: Math.cos(-0.2) },
        { x: 2, y: 0.2, z: 4 },
        [0.5, 0.5, 0.6],
        'metal'
    );
}
