import { quatFromEuler } from './math.js';

export function createIceCaveZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.8, 0.9, 1.0], // Ice color
        'concrete' // We could add an 'ice' material later if needed
    );

    // --- Icy Slope ---
    const slopeAngle = -0.3; // Angle of the slope
    const sinA = Math.sin(slopeAngle / 2);
    const cosA = Math.cos(slopeAngle / 2);
    const slopeQ = { x: sinA, y: 0, z: 0, w: cosA };

    // Positioning the slope so it connects to the entrance
    // The entrance ends at z = 10, so the slope starts around there.
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2.5, z: offset.z + 18 },
        slopeQ,
        { x: 6, y: 0.5, z: 10 },
        [0.7, 0.85, 1.0], // Slightly darker ice
        'concrete'
    );

    // --- Landing Area after slope ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5.5, z: offset.z + 32 },
        floorQ,
        { x: 15, y: 0.5, z: 10 },
        [0.8, 0.9, 1.0], // Ice color
        'concrete'
    );

    // --- Ice Crystal Obstacles ---
    // Let's add some glowing crystal-like pillars on the landing area
    for (let i = 0; i < 5; i++) {
        const cx = offset.x + (Math.random() * 20 - 10);
        const cz = offset.z + 28 + Math.random() * 8;
        const cy = offset.y - 5.5;
        const h = 2 + Math.random() * 3;

        // Random rotation for the crystals
        const angle = Math.random() * Math.PI;
        const q = quatFromEuler(angle, 0, 0);

        game.createStaticBox(
            { x: cx, y: cy + h/2, z: cz },
            q,
            { x: 0.8, y: h/2, z: 0.8 },
            [0.4, 0.8, 1.0], // Bright cyan/blue
            'glass'
        );
    }

    // --- Rotating Ice Platforms ---
    const rotZ = offset.z + 50;
    game.createRotatingBox(
        { x: offset.x - 5, y: offset.y - 5.5, z: rotZ },
        { x: 3, y: 0.5, z: 3 },
        [0.6, 0.8, 1.0],
        'y',
        0.02,
        0,
        'concrete'
    );

    game.createRotatingBox(
        { x: offset.x + 5, y: offset.y - 5.5, z: rotZ + 8 },
        { x: 3, y: 0.5, z: 3 },
        [0.6, 0.8, 1.0],
        'y',
        -0.02,
        Math.PI / 4,
        'concrete'
    );

    // --- Final Path & Goal ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 5.5, z: offset.z + 70 },
        floorQ,
        { x: 8, y: 0.5, z: 12 },
        [0.8, 0.9, 1.0],
        'concrete'
    );

    game.createGoalZone(
        { x: offset.x, y: offset.y - 4.5, z: offset.z + 78 },
        [0.0, 1.0, 1.0] // Cyan goal for ice theme
    );
}
