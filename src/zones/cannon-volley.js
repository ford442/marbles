import { quatFromEuler } from '../math.js';

export function createCannonVolleyZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
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

    // --- Cannon Volleys / Sweepers ---
    // Moving kinematic boxes that shoot across the bridge
    const numCannons = 6;
    for (let i = 0; i < numCannons; i++) {
        const zPos = bridgeStartZ + 5 + i * 8;

        // Stagger the movement
        const amplitude = 5.0;

        // createKinematicBox(pos, halfExtents, color, type, center, amplitude)
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 0.5, z: zPos },
            { x: 0.5, y: 0.5, z: 0.5 }, // Cannonball
            [0.1, 0.1, 0.1], // Dark Iron
            'horizontal',
            offset.x,
            amplitude + Math.random() // slightly different speeds/amplitudes
        );
    }

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
        [0.8, 0.2, 0.2] // Red goal
    );
}
