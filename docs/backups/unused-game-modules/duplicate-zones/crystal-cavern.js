import { quatFromEuler } from '../math.js';
import { createZoneLight } from './methods/visuals.js';

export function createCrystalCavernZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Cavern Area ---
    const cavernStartZ = offset.z + 10;
    const cavernLength = 60;
    const cavernWidth = 20;

    // Floor of the cavern
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: cavernStartZ + cavernLength / 2 },
        floorQ,
        { x: cavernWidth / 2, y: 0.5, z: cavernLength / 2 },
        [0.4, 0.1, 0.6], // Glassy purple
        'glass'
    );

    // --- Crystal Pillars (Static) ---
    // Cyan static obstacles
    for (let i = 0; i < 6; i++) {
        const zPos = cavernStartZ + 5 + i * 10;
        const xPos = offset.x + (i % 2 === 0 ? -4 : 4);

        game.createStaticBox(
            { x: xPos, y: offset.y + 3, z: zPos },
            floorQ,
            { x: 1, y: 5, z: 1 },
            [0.0, 1.0, 1.0], // Cyan crystal
            'glass'
        );
    }

    // --- Moving Crystal Platforms (Kinematic) ---
    // Horizontal moving glowing pink platforms
    for (let i = 0; i < 4; i++) {
        const zPos = cavernStartZ + 10 + i * 12;

        game.createKinematicBox(
            { x: offset.x, y: offset.y + 0.5, z: zPos },
            { x: 2, y: 0.5, z: 2 },
            [1.0, 0.0, 0.8], // Glowing pink
            'horizontal',
            offset.x,
            4.0
        );
    }

    // --- Power-Up (Jump) ---
    game.createPowerUp(
        { x: offset.x, y: offset.y + 1.0, z: cavernStartZ + 30 },
        'jump'
    );

    // --- Exit Platform ---
    const exitZ = cavernStartZ + cavernLength + 5;
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y + 1.0, z: exitZ },
        [0.5, 0.0, 1.0] // Purple goal
    );

    // --- Dynamic Crystal Caustic Lights ---
    // Deep violet emanating from the cavern floor
    createZoneLight(game, 'POINT',
        { x: offset.x, y: offset.y - 1, z: cavernStartZ + 15 },
        [0.55, 0.0, 1.0], 65000.0, 18.0);

    // Cyan glow from the crystal pillar cluster
    createZoneLight(game, 'POINT',
        { x: offset.x - 4, y: offset.y + 5, z: cavernStartZ + 25 },
        [0.0, 1.0, 0.95], 55000.0, 16.0, {
            behavior: 'crystalShimmer',
            shaft: true,
            params: {}
        });

    // Soft pink backlight from moving platforms area
    createZoneLight(game, 'POINT',
        { x: offset.x + 4, y: offset.y + 3, z: cavernStartZ + 45 },
        [1.0, 0.1, 0.75], 50000.0, 15.0, {
            behavior: 'crystalShimmer',
            shaft: true,
            params: {}
        });
}
