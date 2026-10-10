import { quatFromEuler } from '../math.ts';

export function createQuantumCoreZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 8, y: 0.5, z: 8 },
        [0.05, 0.05, 0.1], // Dark blue metallic
        'metal'
    );

    // Entrance Glowing Rim
    game.createStaticBox(
        { x: offset.x, y: offset.y - 0.2, z: offset.z },
        floorQ,
        { x: 8.5, y: 0.2, z: 8.5 },
        [0.0, 0.8, 1.0], // Cyan glow
        'glass'
    );

    // --- Quantum Accelerator Track (Low-Friction Ramps) ---
    const rampLength = 30;
    const rampPitch = -0.2;
    const qRamp = quatFromEuler(rampPitch, 0, 0);
    const rampZ = offset.z + 8 + rampLength / 2;
    const rampY = offset.y - Math.sin(rampPitch * -1) * (rampLength / 2);

    game.createStaticBox(
        { x: offset.x, y: rampY, z: rampZ },
        qRamp,
        { x: 4, y: 0.5, z: rampLength / 2 },
        [0.1, 0.2, 0.5], // Semi-transparent blue ice
        'glass' // Low friction
    );

    // --- The Quantum Core (Central Hub) ---
    const coreZ = offset.z + 8 + rampLength + 15;
    const coreY = offset.y - Math.sin(rampPitch * -1) * rampLength - 2;

    // Main central hub
    game.createStaticBox(
        { x: offset.x, y: coreY, z: coreZ },
        floorQ,
        { x: 15, y: 0.5, z: 15 },
        [0.05, 0.05, 0.1],
        'metal'
    );

    // The glowing core obelisk
    game.createStaticBox(
        { x: offset.x, y: coreY + 6, z: coreZ },
        floorQ,
        { x: 4, y: 6, z: 4 },
        [0.8, 0.0, 1.0], // Purple glow
        'glass'
    );

    // --- Orbiting Quantum Fields (Kinematic Obstacles) ---
    // Horizontal sweeping fields
    for (let i = 0; i < 4; i++) {
        const pz = coreZ - 10 + i * 6.5;
        game.createKinematicBox(
            { x: offset.x, y: coreY + 1, z: pz },
            { x: 3, y: 0.8, z: 0.8 },
            [0.0, 1.0, 1.0], // Cyan
            'horizontal',
            offset.x,
            12.0 // Sweep amplitude
        );
    }

    // Vertical bouncing fields near the core
    game.createKinematicBox(
        { x: offset.x - 7, y: coreY + 4, z: coreZ },
        { x: 1.5, y: 1.5, z: 1.5 },
        [1.0, 0.0, 1.0], // Magenta
        'vertical',
        coreY + 4,
        4.0
    );
    game.createKinematicBox(
        { x: offset.x + 7, y: coreY + 4, z: coreZ },
        { x: 1.5, y: 1.5, z: 1.5 },
        [1.0, 0.0, 1.0], // Magenta
        'vertical',
        coreY + 4,
        4.0
    );

    // --- Exit Ramp ---
    const exitRampZ = coreZ + 15 + rampLength / 2;
    const exitRampY = coreY + Math.sin(rampPitch * -1) * (rampLength / 2); // slopes back up
    const qExitRamp = quatFromEuler(Math.abs(rampPitch), 0, 0);

    game.createStaticBox(
        { x: offset.x, y: exitRampY, z: exitRampZ },
        qExitRamp,
        { x: 4, y: 0.5, z: rampLength / 2 },
        [0.1, 0.2, 0.5],
        'glass'
    );

    // --- Final Landing Zone ---
    const exitZ = coreZ + 15 + rampLength + 8;
    const exitY = coreY + Math.sin(rampPitch * -1) * rampLength;

    game.createStaticBox(
        { x: offset.x, y: exitY, z: exitZ },
        floorQ,
        { x: 8, y: 0.5, z: 8 },
        [0.05, 0.05, 0.1],
        'metal'
    );

    game.createStaticBox(
        { x: offset.x, y: exitY - 0.2, z: exitZ },
        floorQ,
        { x: 8.5, y: 0.2, z: 8.5 },
        [0.0, 0.8, 1.0],
        'glass'
    );
}
