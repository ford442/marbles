export function createQuantumLeapZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Quantum Void Area ---
    const voidStartZ = offset.z + 10;
    const voidLength = 80;

    // --- Ascending Quantum Platforms (Kinematic) ---
    for (let i = 0; i < 15; i++) {
        const zPos = voidStartZ + i * (voidLength / 15);
        const yPos = offset.y + i * 1.5;
        const moveType = i % 2 === 0 ? 'horizontal' : 'vertical';
        const amplitude = 3.0 + Math.random() * 3.0;

        game.createKinematicBox(
            { x: offset.x, y: yPos, z: zPos },
            { x: 2, y: 0.5, z: 2 },
            [0.1, 0.8, 0.9], // Glowing cyan color
            moveType,
            moveType === 'horizontal' ? offset.x : yPos,
            amplitude
        );

        if (i % 3 === 0) {
            game.createPowerUp(
                { x: offset.x, y: yPos + 1.0, z: zPos },
                'jump'
            );
        }
    }

    // --- Exit Platform ---
    const exitZ = voidStartZ + voidLength + 5;
    const exitY = offset.y + 15 * 1.5 - 1.5;

    game.createStaticBox(
        { x: offset.x, y: exitY, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: offset.x, y: exitY + 1.0, z: exitZ },
        [0.9, 0.1, 0.8] // Magenta goal
    );
}
