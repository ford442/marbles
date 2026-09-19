import { quatFromEuler } from '../math.ts';

export function createCyberMatrixZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform (Secure Data Node) ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.05, 0.05, 0.05], // Dark gray/black
        'metal'
    );

    // Glowing rim for entrance
    game.createStaticBox(
        { x: offset.x, y: offset.y - 0.2, z: offset.z },
        floorQ,
        { x: 10.5, y: 0.2, z: 10.5 },
        [0.0, 1.0, 0.2], // Neon Green glow
        'glass'
    );

    // --- Digital Ice Track ---
    // A long, low-friction ramp that simulates data transfer
    const rampLength = 40;
    const rampPitch = -0.15; // Slope downwards
    const qRamp = quatFromEuler(rampPitch, 0, 0);
    const rampZ = offset.z + 10 + rampLength / 2;
    const rampY = offset.y - Math.sin(rampPitch * -1) * (rampLength / 2);

    // Base track (low friction ice)
    game.createStaticBox(
        { x: offset.x, y: rampY, z: rampZ },
        qRamp,
        { x: 5, y: 0.5, z: rampLength / 2 },
        [0.0, 0.1, 0.05], // Dark green ice
        'glass'
    );

    // Neon borders for the ramp
    game.createStaticBox(
        { x: offset.x - 5.5, y: rampY + 0.5, z: rampZ },
        qRamp,
        { x: 0.5, y: 0.5, z: rampLength / 2 },
        [0.0, 1.0, 0.2],
        'glass'
    );
    game.createStaticBox(
        { x: offset.x + 5.5, y: rampY + 0.5, z: rampZ },
        qRamp,
        { x: 0.5, y: 0.5, z: rampLength / 2 },
        [0.0, 1.0, 0.2],
        'glass'
    );

    // --- The CPU Core (Central Obstacle) ---
    const coreZ = offset.z + 10 + rampLength + 10;
    const coreY = offset.y - Math.sin(rampPitch * -1) * rampLength - 2;

    // Platform around the core
    game.createStaticBox(
        { x: offset.x, y: coreY, z: coreZ },
        floorQ,
        { x: 15, y: 0.5, z: 15 },
        [0.05, 0.05, 0.05],
        'metal'
    );

    // The Core itself (a glowing obelisk)
    game.createStaticBox(
        { x: offset.x, y: coreY + 5, z: coreZ },
        floorQ,
        { x: 3, y: 5, z: 3 },
        [0.0, 0.8, 0.4],
        'glass'
    );

    // --- Kinematic Data Packets (Moving Obstacles) ---
    // Orbiting or sliding data blocks around the core
    for (let i = 0; i < 3; i++) {
        const pz = coreZ - 10 + i * 10;
        const px = offset.x; // Centers for horizontal movement

        game.createKinematicBox(
            { x: px, y: coreY + 1.5, z: pz },
            { x: 2, y: 1, z: 1 },
            [1.0, 0.0, 0.2], // Error/Red data packet
            'horizontal',
            offset.x,
            8.0 // Amplitude
        );
    }

    // --- Exit Platform ---
    const exitZ = coreZ + 20;
    game.createStaticBox(
        { x: offset.x, y: coreY, z: exitZ },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.05, 0.05, 0.05],
        'metal'
    );

    // Exit Glowing rim
    game.createStaticBox(
        { x: offset.x, y: coreY - 0.2, z: exitZ },
        floorQ,
        { x: 10.5, y: 0.2, z: 10.5 },
        [0.0, 1.0, 0.2], // Neon Green glow
        'glass'
    );
}
