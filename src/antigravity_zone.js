import { quatFromEuler } from './math.js';

export function createAntigravityZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.2, 0.4, 0.8],
        'metal'
    );

    // --- Anti-Gravity Chamber Tube ---
    // A series of rings to denote the chamber
    const numRings = 10;
    const ringSpacing = 10;
    for (let i = 0; i < numRings; i++) {
        const z = offset.z + 15 + i * ringSpacing;

        // Bottom pad (Gravity Powerup to make player float)
        game.createPowerUp({ x: offset.x, y: offset.y + 1, z: z }, 'gravity');

        // Ring visual
        for (let j = 0; j < 8; j++) {
            const angle = (j / 8) * Math.PI * 2;
            const radius = 8;
            const rx = offset.x + Math.sin(angle) * radius;
            const ry = offset.y + 5 + Math.cos(angle) * radius;

            const q = quatFromEuler(0, 0, angle);

            game.createStaticBox(
                { x: rx, y: ry, z: z },
                q,
                { x: 2, y: 0.5, z: 1 },
                [0.0, 1.0, 1.0], // Cyan glowing ring
                'glass'
            );
        }

        // Floating Obstacles
        const obsX = offset.x + Math.sin(i * 1.5) * 5;
        const obsY = offset.y + 2 + Math.cos(i * 1.5) * 4;

        game.createKinematicBox(
            { x: obsX, y: obsY, z: z + ringSpacing / 2 },
            { x: 2, y: 0.5, z: 2 },
            [0.8, 0.2, 0.8],
            i % 2 === 0 ? 'horizontal' : 'vertical',
            i % 2 === 0 ? obsX : obsY,
            3.0
        );
    }

    // --- Exit Platform ---
    const exitZ = offset.z + 15 + numRings * ringSpacing;
    game.createStaticBox(
        { x: offset.x, y: offset.y + 5, z: exitZ }, // Note: elevated exit
        floorQ,
        { x: 10, y: 0.5, z: 15 },
        [0.2, 0.8, 0.4],
        'metal'
    );
}

export const antigravityLevel = {
    name: 'Anti-Gravity Chamber',
    description: 'Use gravity power-ups to float through the rings!',
    zones: [
        { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
        { type: 'track', pos: { x: 0, y: 3, z: 0 } },
        { type: 'antigravity', pos: { x: 0, y: 0, z: 25 } },
        { type: 'goal', pos: { x: 0, y: 5.25, z: 145 } }
    ],
    spawn: { x: 0, y: 8, z: -12 },
    goals: [
        { id: 1, range: { x: [-5, 5], z: [140, 150], y: [4, 8] } }
    ],
    camera: { mode: 'follow', height: 15, offset: -25 },
    nightMode: true,
    backgroundColor: [0.0, 0.0, 0.1, 1.0]
};
