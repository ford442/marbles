import { quatFromEuler } from './math.js';

export function createHelixZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Base Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.4, 0.5],
        'concrete'
    );

    // --- Central Pillar (Visual Support) ---
    const height = 40;
    game.createStaticBox(
        { x: offset.x, y: offset.y + height / 2, z: offset.z },
        floorQ,
        { x: 2, y: height / 2, z: 2 },
        [0.2, 0.2, 0.3],
        'concrete'
    );

    // --- Double Helix Generation ---
    const numSteps = 80;
    const radius = 8;
    const heightGain = 0.5;
    const angleStep = 0.2;

    for (let i = 0; i < numSteps; i++) {
        const angle = i * angleStep;
        const y = offset.y + i * heightGain + 2; // Start slightly above base

        // Helix 1
        const x1 = offset.x + Math.cos(angle) * radius;
        const z1 = offset.z + Math.sin(angle) * radius;

        // Helix 2 (Phase shifted by PI)
        const x2 = offset.x + Math.cos(angle + Math.PI) * radius;
        const z2 = offset.z + Math.sin(angle + Math.PI) * radius;

        // Rotation to bank the track slightly inward and follow curve
        const rotY = -angle;
        const bankAngle = 0.2; // Bank inward
        const pitch = -0.1; // Slope up

        // We need to combine these rotations.
        // Simple approximation: Rotate Y first, then bank (Roll/Pitch relative to path)
        const q1 = quatFromEuler(rotY, pitch, bankAngle);
        const q2 = quatFromEuler(rotY + Math.PI, pitch, bankAngle);

        // Track Segments
        game.createStaticBox(
            { x: x1, y: y, z: z1 },
            q1,
            { x: 1.5, y: 0.2, z: 1.2 },
            [0.2 + (i / numSteps) * 0.8, 0.5, 0.5], // Gradient Color
            'wood'
        );

        game.createStaticBox(
            { x: x2, y: y, z: z2 },
            q2,
            { x: 1.5, y: 0.2, z: 1.2 },
            [0.5, 0.5, 0.2 + (i / numSteps) * 0.8], // Gradient Color
            'wood'
        );

        // Occasional Connectors/Obstacles
        if (i % 10 === 0 && i > 0 && i < numSteps - 5) {
            // Connector beam between helixes
             const cx = offset.x;
             const cz = offset.z;
             // Only if they are aligned roughly with X or Z to avoid complex math for now?
             // Actually, just a beam from the pillar outwards might be cool

             // Let's add obstacle blocks on the track instead
             game.createStaticBox(
                { x: x1, y: y + 1, z: z1 },
                q1,
                { x: 0.5, y: 0.5, z: 0.5 },
                [0.8, 0.2, 0.2],
                'metal'
             );
        }
    }

    // --- Top Platform ---
    const topY = offset.y + numSteps * heightGain + 2;
    game.createStaticBox(
        { x: offset.x, y: topY, z: offset.z },
        floorQ,
        { x: 10, y: 0.5, z: 10 },
        [0.8, 0.8, 0.9],
        'metal'
    );
}
