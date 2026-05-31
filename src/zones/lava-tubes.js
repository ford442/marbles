import { quatFromEuler } from '../math.js';
import { createZoneLight } from './methods/visuals.js';

export function createLavaTubesZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // Lava Floor
    const tubeStartZ = offset.z + 10;
    const tubeLength = 60;
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5, z: tubeStartZ + tubeLength / 2 },
        floorQ,
        { x: 15, y: 0.5, z: tubeLength / 2 },
        [1.0, 0.2, 0.0],
        'glass'
    );

    // Tube Segments (Static)
    for (let i = 0; i < 4; i++) {
        const zPos = tubeStartZ + 5 + i * 15;
        game.createStaticBox(
            { x: offset.x, y: offset.y, z: zPos },
            floorQ,
            { x: 3, y: 0.5, z: 4 },
            [0.3, 0.3, 0.35],
            'metal'
        );
    }

    // Kinematic Sweepers
    for (let i = 0; i < 3; i++) {
        const zPos = tubeStartZ + 12 + i * 15;
        game.createKinematicBox(
            { x: offset.x, y: offset.y + 2, z: zPos },
            { x: 4, y: 0.5, z: 1 },
            [1.0, 0.5, 0.0],
            'vertical',
            offset.y + 2,
            4.0
        );
    }

    // Exit Platform
    const exitZ = tubeStartZ + tubeLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [1.0, 0.0, 0.0] // Red goal
    );

    // --- Dynamic Lava Glow Lights ---
    // Deep orange-red lava glow rising from the lava floor beneath the tubes
    // With lavaFlicker animation for immersive atmosphere
    createZoneLight(game, 'POINT',
        { x: offset.x - 3, y: offset.y - 3, z: tubeStartZ + 10 },
        [1.0, 0.25, 0.0], 80000.0, 18.0, {
            behavior: 'lavaFlicker',
            shaft: true,
            params: { speed: 7.0, flicker: 0.4 }
        });

    createZoneLight(game, 'POINT',
        { x: offset.x + 3, y: offset.y - 3, z: tubeStartZ + 30 },
        [1.0, 0.15, 0.0], 90000.0, 20.0, {
            behavior: 'lavaFlicker',
            shaft: true,
            params: { speed: 8.0, flicker: 0.5 }
        });

    createZoneLight(game, 'POINT',
        { x: offset.x, y: offset.y - 3, z: tubeStartZ + 50 },
        [1.0, 0.3, 0.0], 70000.0, 16.0, {
            behavior: 'lavaFlicker',
            shaft: true,
            params: { speed: 6.5, flicker: 0.35 }
        });

    // --- Environmental Ember & Spark Emitters ---
    // Rising ember sparks from the lava floor give the zone a visceral, fiery feel
    if (game.particleSystem) {
        const emberSpots = [
            { x: offset.x - 5, z: tubeStartZ + 8 },
            { x: offset.x + 4, z: tubeStartZ + 18 },
            { x: offset.x - 3, z: tubeStartZ + 28 },
            { x: offset.x + 5, z: tubeStartZ + 38 },
            { x: offset.x,     z: tubeStartZ + 48 }
        ];
        for (const spot of emberSpots) {
            game.particleSystem.addAmbientEmitter({
                pos: { x: spot.x, y: offset.y - 4.5, z: spot.z },
                type: 'spark',
                rate: 2.5,
                count: 2,
                spread: 4,
                params: {
                    lifetime: 1.2 + Math.random() * 0.6,
                    size: 0.08 + Math.random() * 0.06,
                    color: [1.0, 0.45 + Math.random() * 0.25, 0.0, 1.0]
                }
            });
        }
    }
}
