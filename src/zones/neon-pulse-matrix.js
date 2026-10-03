import { quatFromEuler } from '../math.ts';

export function createNeonPulseMatrixZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    console.log('[ZONE] Creating Neon Pulse Matrix zone at', offset);

    // 1. Entrance Platform
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.05, 0.05, 0.1], // Dark space
        'metal'
    );

    // Entrance Glow Rim
    game.createStaticBox(
        { x: offset.x, y: offset.y - 0.2, z: offset.z },
        floorQ,
        { x: 10.5, y: 0.2, z: 10.5 },
        [1.0, 0.0, 0.5], // Neon Magenta glow
        'glass'
    );

    // 2. The Low-Friction Ice Pulse Track
    const trackSegments = 8;
    const segmentLength = 8;
    const trackZStart = offset.z + 10 + segmentLength / 2;

    for (let i = 0; i < trackSegments; i++) {
        const segZ = trackZStart + i * segmentLength;
        const color = i % 2 === 0 ? [0.0, 1.0, 1.0] : [1.0, 0.0, 0.5]; // Alternating Cyan and Magenta

        // Glass track (low friction inherently or via 'glass' material mapping in standard setup)
        game.createStaticBox(
            { x: offset.x, y: offset.y - i * 0.5, z: segZ },
            floorQ,
            { x: 5, y: 0.2, z: segmentLength / 2 },
            color,
            'glass'
        );

        // Track Side Rails
        game.createStaticBox(
            { x: offset.x - 5.5, y: offset.y - i * 0.5 + 0.5, z: segZ },
            floorQ,
            { x: 0.5, y: 0.5, z: segmentLength / 2 },
            [0.1, 0.1, 0.2],
            'glass'
        );
        game.createStaticBox(
            { x: offset.x + 5.5, y: offset.y - i * 0.5 + 0.5, z: segZ },
            floorQ,
            { x: 0.5, y: 0.5, z: segmentLength / 2 },
            [0.1, 0.1, 0.2],
            'glass'
        );
    }

    const endOfTrackZ = trackZStart + trackSegments * segmentLength;
    const endOfTrackY = offset.y - (trackSegments - 1) * 0.5;

    // 3. Central Obstacle Grid (Kinematic Data Streams)
    const gridZStart = endOfTrackZ + 10;
    const gridY = endOfTrackY - 2;

    // Grid Floor
    game.createStaticBox(
        { x: offset.x, y: gridY, z: gridZStart + 15 },
        floorQ,
        { x: 15, y: 0.5, z: 20 },
        [0.05, 0.05, 0.1],
        'metal'
    );

    // Moving Data Streams
    for (let i = 0; i < 4; i++) {
        const rowZ = gridZStart + 5 + i * 8;
        const speed = 2.0 + i * 0.5;
        const color = i % 2 === 0 ? [1.0, 0.8, 0.0] : [0.0, 1.0, 0.5]; // Yellow and Green Streams

        game.createKinematicBox(
            { x: offset.x, y: gridY + 1.5, z: rowZ },
            { x: 2, y: 1, z: 1 },
            color,
            'horizontal',
            offset.x,
            12.0 // Amplitude to cover the 15-width floor
        );
    }

    // 4. Final Jump Ramp
    const rampZ = gridZStart + 35;
    const rampY = gridY;
    const qRamp = quatFromEuler(0.3, 0, 0); // Pitched up

    game.createStaticBox(
        { x: offset.x, y: rampY + 1.5, z: rampZ },
        qRamp,
        { x: 4, y: 0.5, z: 4 },
        [1.0, 0.5, 0.0], // Orange Ramp
        'glass'
    );

    // 5. Exit Platform (Target)
    const exitZ = rampZ + 25;
    const exitY = rampY + 5;

    game.createStaticBox(
        { x: offset.x, y: exitY, z: exitZ },
        floorQ,
        { x: 8, y: 0.5, z: 8 },
        [0.05, 0.05, 0.1],
        'metal'
    );

    // Exit Glow Rim
    game.createStaticBox(
        { x: offset.x, y: exitY - 0.2, z: exitZ },
        floorQ,
        { x: 8.5, y: 0.2, z: 8.5 },
        [0.0, 1.0, 1.0], // Neon Cyan glow
        'glass'
    );
}
