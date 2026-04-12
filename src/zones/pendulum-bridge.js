import { quatFromEuler } from '../math.js';

export function createPendulumBridgeZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.4, 0.45],
        'concrete'
    );

    // --- The Bridge ---
    const bridgeStartZ = offset.z + 10;
    const bridgeLength = 60;

    // Narrow bridge for the player to cross
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: bridgeStartZ + bridgeLength / 2 - 5 },
        floorQ,
        { x: 1.5, y: 0.5, z: bridgeLength / 2 },
        [0.6, 0.5, 0.4],
        'wood'
    );

    // --- Pendulums / Sweepers ---
    // Moving kinematic boxes that swing across the bridge
    const numPendulums = 5;
    for (let i = 0; i < numPendulums; i++) {
        const zPos = bridgeStartZ + 5 + i * 10;

        // Stagger the movement
        const amplitude = 4.0;

        // createKinematicBox(pos, halfExtents, color, type, center, amplitude)
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos },
            { x: 2, y: 0.5, z: 0.5 }, // Wide sweeper
            [0.8, 0.2, 0.1], // Danger Red
            'horizontal',
            offset.x,
            amplitude + Math.random() // slightly different speeds/amplitudes
        );
    }

    // --- Power-Up (Speed) ---
    // Give player a chance to sprint across
    game.createPowerUp(
        { x: offset.x, y: offset.y + 1.5, z: bridgeStartZ + 25 },
        'speed'
    );

    // --- Exit Platform ---
    const exitZ = bridgeStartZ + bridgeLength;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.2, 0.8, 0.2] // Green goal
    );
}
