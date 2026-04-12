import { quatFromEuler } from '../math.js';

export function createMagnetFacilityZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.8],
        'metal'
    );

    // --- Magnetic Tunnel ---
    const tunnelZ = offset.z + 15;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: tunnelZ },
        floorQ,
        { x: 3, y: 0.5, z: 10 },
        [0.1, 0.1, 0.8],
        'metal'
    );

    // Tunnel Walls
    game.createStaticBox(
        { x: offset.x - 3, y: offset.y + 2, z: tunnelZ },
        floorQ,
        { x: 0.5, y: 2, z: 10 },
        [0.8, 0.1, 0.1],
        'metal'
    );
    game.createStaticBox(
        { x: offset.x + 3, y: offset.y + 2, z: tunnelZ },
        floorQ,
        { x: 0.5, y: 2, z: 10 },
        [0.8, 0.1, 0.1],
        'metal'
    );

    // Tunnel Roof
    game.createStaticBox(
        { x: offset.x, y: offset.y + 4.5, z: tunnelZ },
        floorQ,
        { x: 3.5, y: 0.5, z: 10 },
        [0.1, 0.1, 0.8],
        'metal'
    );

    // --- Moving Magnetic Platforms ---
    const platZ1 = tunnelZ + 15;
    game.createKinematicBox(
        { x: offset.x - 5, y: offset.y, z: platZ1 },
        { x: 2, y: 0.5, z: 2 },
        [0.8, 0.8, 0.1],
        'horizontal',
        offset.x,
        5.0
    );

    const platZ2 = platZ1 + 10;
    game.createKinematicBox(
        { x: offset.x, y: offset.y - 3, z: platZ2 },
        { x: 2, y: 0.5, z: 2 },
        [0.8, 0.8, 0.1],
        'vertical',
        offset.y,
        3.0
    );

    // --- Goal Area ---
    const goalZ = platZ2 + 10;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: goalZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.8],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1, z: goalZ },
        [0.0, 1.0, 0.0]
    );
}
