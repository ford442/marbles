import { quatFromEuler } from '../math.js';

export function createNeonTrackZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    // --- Main Neon Track ---
    const trackStartZ = offset.z + 10;
    const trackLength = 40;
    const trackWidth = 8;

    // Track Floor
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: trackStartZ + trackLength / 2 },
        floorQ,
        { x: trackWidth / 2, y: 0.5, z: trackLength / 2 },
        [0.05, 0.05, 0.1], // Dark floor
        'concrete'
    );

    // Neon Side Bumpers
    game.createStaticBox(
        { x: offset.x - trackWidth / 2, y: offset.y + 1, z: trackStartZ + trackLength / 2 },
        floorQ,
        { x: 0.5, y: 1, z: trackLength / 2 },
        [0.0, 1.0, 1.0], // Cyan neon glow
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + trackWidth / 2, y: offset.y + 1, z: trackStartZ + trackLength / 2 },
        floorQ,
        { x: 0.5, y: 1, z: trackLength / 2 },
        [1.0, 0.0, 1.0], // Magenta neon glow
        'metal'
    );

    // --- Moving Neon Gates (Kinematic) ---
    for (let i = 0; i < 3; i++) {
        const gateZ = trackStartZ + 10 + i * 10;

        // Horizontal moving bar to block path
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: gateZ },
            { x: trackWidth / 2 - 1, y: 0.5, z: 0.5 },
            [1.0, 1.0, 0.0], // Yellow gate
            'horizontal',
            offset.x,
            2.0 // Amplitude
        );
    }

    // --- Power-Up (Speed) ---
    game.createPowerUp(
        { x: offset.x, y: offset.y + 1.5, z: trackStartZ + 20 },
        'speed'
    );

    // --- Exit Platform ---
    const exitZ = trackStartZ + trackLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.0, 1.0, 0.5] // Greenish goal
    );
}
