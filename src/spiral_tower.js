import { quatFromEuler } from './math.js';

export function createSpiralTowerZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Base Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 8, y: 0.5, z: 8 },
        [0.3, 0.3, 0.35],
        'concrete'
    );

    // --- Central Pillar ---
    const pillarHeight = 50;
    const pillarRadius = 2.5;
    game.createStaticBox(
        { x: offset.x, y: offset.y + pillarHeight / 2, z: offset.z },
        floorQ,
        { x: pillarRadius, y: pillarHeight / 2, z: pillarRadius },
        [0.25, 0.25, 0.3],
        'concrete'
    );

    // --- Spiral Staircase Generation ---
    const numSteps = 100;
    const radius = 6.0;
    const heightGain = 0.4;
    const angleStep = 0.25;

    // We'll create "gaps" every 15 steps
    const gapInterval = 15;
    const gapSize = 3;

    for (let i = 0; i < numSteps; i++) {
        // Skip steps to create gaps
        if (i % gapInterval >= gapInterval - gapSize) {
            // Add a moving platform in the middle of the gap
            if (i % gapInterval === gapInterval - Math.ceil(gapSize / 2)) {
                const angle = i * angleStep;
                const y = offset.y + i * heightGain + 0.5;
                const x = offset.x + Math.cos(angle) * radius;
                const z = offset.z + Math.sin(angle) * radius;

                // Kinematic platform moving in/out or up/down?
                // Let's make it move vertically slightly
                game.createKinematicBox(
                    { x: x, y: y, z: z },
                    { x: 1.5, y: 0.2, z: 1.5 },
                    [0.2, 0.8, 0.8],
                    'vertical',
                    y,
                    1.5 // Amplitude
                );
            }
            continue;
        }

        const angle = i * angleStep;
        const y = offset.y + i * heightGain + 0.5;
        const x = offset.x + Math.cos(angle) * radius;
        const z = offset.z + Math.sin(angle) * radius;

        // Rotation to align step with tangent + slight pitch up
        const rotY = -angle;
        const pitch = -0.1;
        const q = quatFromEuler(rotY, pitch, 0);

        game.createStaticBox(
            { x: x, y: y, z: z },
            q,
            { x: 2.0, y: 0.15, z: 1.2 },
            [0.6 + (i/numSteps)*0.4, 0.4, 0.2],
            'wood'
        );

        // Add some small obstacles on the stairs occasionally
        if (i % 8 === 0 && i > 5) {
             game.createStaticBox(
                { x: x, y: y + 0.5, z: z },
                q,
                { x: 0.5, y: 0.5, z: 0.5 },
                [0.8, 0.2, 0.2],
                'metal'
             );
        }
    }

    // --- Top Platform ---
    const topY = offset.y + numSteps * heightGain + 0.5;
    const topAngle = numSteps * angleStep;
    const topX = offset.x + Math.cos(topAngle) * (radius - 1);
    const topZ = offset.z + Math.sin(topAngle) * (radius - 1);

    game.createStaticBox(
        { x: topX, y: topY, z: topZ },
        floorQ,
        { x: 4, y: 0.5, z: 4 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    // --- Goal ---
    game.createGoalZone(
        { x: topX, y: topY + 1.0, z: topZ },
        [1.0, 0.84, 0.0]
    );

    // --- Falling Debris (Dynamic Objects) ---
    // Spawn some spheres at the top that might roll down
    for(let j=0; j<5; j++) {
        const dropAngle = topAngle - 0.5 - (j * 0.5);
        const dx = offset.x + Math.cos(dropAngle) * radius;
        const dz = offset.z + Math.sin(dropAngle) * radius;
        const dy = topY + 5 + j*2;

        game.createDynamicBox( // Using box but simulating debris
            { x: dx, y: dy, z: dz },
            floorQ,
            { x: 0.5, y: 0.5, z: 0.5 },
            [0.5, 0.5, 0.5],
            2.0, // Density
            'concrete'
        );
    }
}
