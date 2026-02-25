import { quatFromEuler } from './math.js';

export const skateParkLevel = {
    name: 'Skate Park',
    description: 'Shred the gnar!',
    zones: [
        { type: 'skate_park', pos: { x: 0, y: 0, z: 0 } },
        { type: 'goal', pos: { x: 0, y: 2, z: 60 } }
    ],
    spawn: { x: 0, y: 5, z: -10 },
    goals: [
        { id: 1, range: { x: [-3, 3], z: [58, 62], y: [0, 5] } }
    ],
    camera: { mode: 'follow', height: 10, offset: -15 },
    nightMode: false
};

export function createSkateParkZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Floor
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z + 25 },
        floorQ,
        { x: 20, y: 0.5, z: 35 },
        [0.4, 0.4, 0.45],
        'concrete'
    );

    // Entrance Ramp
    const rampAngle = -0.25;
    const rampQ = quatFromEuler(0, rampAngle, 0);
    game.createStaticBox(
        { x: offset.x, y: offset.y + 2, z: offset.z - 5 },
        rampQ,
        { x: 5, y: 0.2, z: 6 },
        [0.5, 0.5, 0.55],
        'concrete'
    );

    // Half-Pipe (Left Side)
    for (let i = 0; i < 10; i++) {
        const angle = i * 0.15; // Curve up
        const zBase = offset.z + 10;
        const x = offset.x - 8 - Math.sin(angle) * 3;
        const y = offset.y + 0.5 + (1 - Math.cos(angle)) * 3;

        const q = quatFromEuler(0, 0, -angle);

        game.createStaticBox(
            { x: x, y: y, z: zBase },
            q,
            { x: 1.5, y: 0.2, z: 8 },
            [0.6, 0.3, 0.3],
            'wood'
        );
    }

    // Half-Pipe (Right Side)
    for (let i = 0; i < 10; i++) {
        const angle = i * 0.15;
        const zBase = offset.z + 10;
        const x = offset.x + 8 + Math.sin(angle) * 3;
        const y = offset.y + 0.5 + (1 - Math.cos(angle)) * 3;

        const q = quatFromEuler(0, 0, angle);

        game.createStaticBox(
            { x: x, y: y, z: zBase },
            q,
            { x: 1.5, y: 0.2, z: 8 },
            [0.6, 0.3, 0.3],
            'wood'
        );
    }

    // Funbox (Pyramid)
    const fbZ = offset.z + 30;
    // Central flat
    game.createStaticBox(
        { x: offset.x, y: offset.y + 1.5, z: fbZ },
        floorQ,
        { x: 3, y: 0.2, z: 3 },
        [0.3, 0.3, 0.8],
        'wood'
    );
    // Ramps
    game.createStaticBox({ x: offset.x, y: offset.y + 0.75, z: fbZ - 4.5 }, quatFromEuler(0, -0.3, 0), { x: 3, y: 0.2, z: 2.5 }, [0.3, 0.3, 0.7], 'wood'); // Front
    game.createStaticBox({ x: offset.x, y: offset.y + 0.75, z: fbZ + 4.5 }, quatFromEuler(0, 0.3, 0), { x: 3, y: 0.2, z: 2.5 }, [0.3, 0.3, 0.7], 'wood'); // Back
    game.createStaticBox({ x: offset.x - 4.5, y: offset.y + 0.75, z: fbZ }, quatFromEuler(0, 0, 0.3), { x: 2.5, y: 0.2, z: 3 }, [0.3, 0.3, 0.7], 'wood'); // Left
    game.createStaticBox({ x: offset.x + 4.5, y: offset.y + 0.75, z: fbZ }, quatFromEuler(0, 0, -0.3), { x: 2.5, y: 0.2, z: 3 }, [0.3, 0.3, 0.7], 'wood'); // Right

    // Grind Rail
    const railZ = offset.z + 45;
    game.createStaticBox(
        { x: offset.x, y: offset.y + 0.8, z: railZ },
        floorQ,
        { x: 0.2, y: 0.1, z: 8 },
        [0.9, 0.9, 0.1],
        'metal'
    );
    // Supports
    game.createStaticBox({ x: offset.x, y: offset.y + 0.4, z: railZ - 6 }, floorQ, { x: 0.1, y: 0.4, z: 0.1 }, [0.2, 0.2, 0.2], 'metal');
    game.createStaticBox({ x: offset.x, y: offset.y + 0.4, z: railZ }, floorQ, { x: 0.1, y: 0.4, z: 0.1 }, [0.2, 0.2, 0.2], 'metal');
    game.createStaticBox({ x: offset.x, y: offset.y + 0.4, z: railZ + 6 }, floorQ, { x: 0.1, y: 0.4, z: 0.1 }, [0.2, 0.2, 0.2], 'metal');

    // Dynamic Cones
    for (let i = 0; i < 5; i++) {
        game.createDynamicBox(
            { x: offset.x + (Math.random() - 0.5) * 10, y: offset.y + 2, z: offset.z + 20 + Math.random() * 20 },
            floorQ,
            { x: 0.3, y: 0.5, z: 0.3 },
            [1.0, 0.5, 0.0],
            0.2, // Light
            'plastic'
        );
    }
}
