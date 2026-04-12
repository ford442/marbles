import { quatFromEuler } from '../math.js';

export function createToxicSwampZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // Toxic Swamp Floor (Hazard)
    game.createStaticBox(
        { x: offset.x, y: offset.y - 3, z: offset.z + 45 },
        floorQ,
        { x: 20, y: 0.5, z: 45 },
        [0.1, 0.8, 0.1], // Glowing green
        'glass'
    );

    // Stepping Stones
    for (let i = 0; i < 5; i++) {
        const zPos = offset.z + 15 + i * 15;
        const xOffset = (i % 2 === 0 ? 1 : -1) * 5;

        if (i % 2 === 0) {
            // Static stone
            game.createStaticBox(
                { x: offset.x + xOffset, y: offset.y - 0.5, z: zPos },
                floorQ,
                { x: 3, y: 0.5, z: 3 },
                [0.4, 0.4, 0.4],
                'concrete'
            );
        } else {
            // Kinematic vertical moving stone
            game.createKinematicBox(
                { x: offset.x + xOffset, y: offset.y - 0.5, z: zPos },
                { x: 3, y: 0.5, z: 3 },
                [0.4, 0.4, 0.4],
                'vertical',
                offset.y - 0.5,
                2.0
            );
        }

        // Horizontal sweepers (warning arms)
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 1, z: zPos + 7.5 },
            { x: 10, y: 0.5, z: 0.5 },
            [0.8, 0.8, 0.1], // Yellow warning
            'horizontal',
            offset.x,
            8.0
        );
    }

    // Exit Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 90 },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: offset.z + 90 },
        [0.1, 0.8, 0.1]
    );
}
