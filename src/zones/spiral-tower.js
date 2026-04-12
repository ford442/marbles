import { quatFromEuler } from '../math.js';

export function createSpiralTowerZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Entrance Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.25],
        'concrete'
    );

    // --- Central Spire ---
    const towerRadius = 4.0;
    const towerHeight = 30.0;
    const towerCenterZ = offset.z + 20.0;
    game.createStaticBox(
        { x: offset.x, y: offset.y + towerHeight / 2 - 2, z: towerCenterZ },
        floorQ,
        { x: towerRadius, y: towerHeight / 2 + 2, z: towerRadius },
        [0.1, 0.1, 0.15],
        'concrete'
    );

    // --- Spiral Track ---
    const numSteps = 40;
    const stepHeight = 0.8;
    const angleStep = Math.PI / 6; // 30 degrees per step
    const platformWidth = 3.0;
    const platformDepth = 2.0;
    const platformRadius = towerRadius + platformDepth;

    for (let i = 0; i < numSteps; i++) {
        const angle = i * angleStep;
        const yPos = offset.y + i * stepHeight + 1.0;

        const xPos = offset.x + Math.sin(angle) * platformRadius;
        const zPos = towerCenterZ + Math.cos(angle) * platformRadius;

        // Quat to align the platform tangentially or radially
        // We want the platform to face the center, so rotate around Y axis
        const qY = Math.sin(angle / 2);
        const qW = Math.cos(angle / 2);
        const q = { x: 0, y: qY, z: 0, w: qW };

        // For simple stepping stones, we can just use floorQ if we make them roughly square
        game.createStaticBox(
            { x: xPos, y: yPos, z: zPos },
            q,
            { x: platformWidth / 2, y: 0.2, z: platformDepth / 2 },
            [0.2, 0.6, 0.8], // Cyan-ish steps
            'concrete'
        );

        // Add some power-ups or obstacles occasionally
        if (i > 5 && i % 8 === 0) {
            game.createPowerUp(
                { x: xPos, y: yPos + 1.0, z: zPos },
                'jump'
            );
        } else if (i > 5 && i % 5 === 0) {
            // Kinematic obstacle moving up and down
            game.createKinematicBox(
                { x: xPos, y: yPos + 1.5, z: zPos },
                { x: platformWidth / 2 - 0.2, y: 0.2, z: 0.2 },
                [1.0, 0.2, 0.2], // Red danger
                'vertical',
                yPos + 1.5,
                1.5
            );
        }
    }

    // --- Exit Platform ---
    const topY = offset.y + numSteps * stepHeight;
    const exitAngle = numSteps * angleStep;
    const exitX = offset.x + Math.sin(exitAngle) * (platformRadius + 5.0);
    const exitZ = towerCenterZ + Math.cos(exitAngle) * (platformRadius + 5.0);

    game.createStaticBox(
        { x: exitX, y: topY, z: exitZ },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.8, 0.8, 0.9],
        'metal'
    );

    game.createGoalZone(
        { x: exitX, y: topY + 1.0, z: exitZ },
        [1.0, 0.8, 0.0] // Gold goal
    );
}
