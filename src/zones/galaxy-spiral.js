export function createGalaxySpiralZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.4],
        'concrete'
    );

    const spiralStartZ = offset.z + 15;

    // --- Central Pillar ---
    const pillarHeight = 30;
    game.createStaticBox(
        { x: offset.x, y: offset.y + pillarHeight / 2, z: spiralStartZ },
        floorQ,
        { x: 2, y: pillarHeight / 2, z: 2 },
        [0.1, 0.1, 0.15],
        'metal'
    );

    // --- Ascending Spiral Platforms ---
    const numSteps = 40;
    const radius = 6;
    const heightPerStep = 0.75;
    const anglePerStep = 0.3;

    for (let i = 0; i < numSteps; i++) {
        const angle = i * anglePerStep;
        const currentY = offset.y + (i * heightPerStep);
        const platformX = offset.x + Math.sin(angle) * radius;
        const platformZ = spiralStartZ + Math.cos(angle) * radius;

        // Give them a glowing galaxy color (purple/blue)
        const color = [0.4 + (i / numSteps) * 0.4, 0.2, 0.8 + (i / numSteps) * 0.2];

        // We want the platforms to angle slightly to point towards the center or just be flat
        // Let's keep them flat for easier jumping
        game.createStaticBox(
            { x: platformX, y: currentY, z: platformZ },
            floorQ,
            { x: 1.5, y: 0.25, z: 1.5 },
            color,
            'glass'
        );

        // Add some kinematic sweepers on some platforms
        if (i > 5 && i < numSteps - 5 && i % 8 === 0) {
            game.createKinematicBox(
                { x: platformX, y: currentY + 0.5, z: platformZ },
                { x: 2, y: 0.25, z: 0.25 },
                [0.9, 0.1, 0.2],
                'horizontal',
                platformX,
                2.0
            );
        }
    }

    // --- Exit Platform ---
    const finalAngle = (numSteps - 1) * anglePerStep;
    const exitY = offset.y + (numSteps - 1) * heightPerStep;
    const finalX = offset.x + Math.sin(finalAngle) * radius;
    const finalZ = spiralStartZ + Math.cos(finalAngle) * radius;

    // Bridge from last step to exit platform
    game.createStaticBox(
        { x: finalX + Math.sin(finalAngle) * 3, y: exitY, z: finalZ + Math.cos(finalAngle) * 3 },
        floorQ,
        { x: 4, y: 0.5, z: 4 },
        [0.8, 0.8, 0.9],
        'metal'
    );
}
