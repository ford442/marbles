export function createNeonCityHeightsZone(game, offset) {
    const zone = game;
    const pos = offset;
    const F = zone.game?.Filament || zone.Filament;
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    console.log('[ZONE] Creating Neon City Heights zone at', pos);

    // 1. Entrance Platform
    zone.createFloorZone({ x: pos.x, y: pos.y, z: pos.z - 30 }, {
        width: 10, depth: 10, friction: 0.8, color: [0.1, 0.1, 0.15]
    });

    // 2. Icy Low-Friction Track (Neon Blue/Purple)
    const slideMaterial = zone.material.createInstance();
    slideMaterial.setColor3Parameter('baseColor', F.RgbType.sRGB, [0.4, 0.1, 0.8]); // Purple ice
    slideMaterial.setFloatParameter('roughness', 0.0);

    zone.createTrackZone({ x: pos.x, y: pos.y - 5, z: pos.z }, {
        width: 10,
        length: 40,
        slope: 0.15,
        friction: 0.01,
        restitution: 0.1,
        customMaterial: slideMaterial
    });

    // 3. Neon City Hover Cars / Platforms (Kinematic Moving Platforms)
    for (let i = 0; i < 4; i++) {
        const zOffset = pos.z + 30 + (i * 12);
        const startX = pos.x + (i % 2 === 0 ? -15 : 15);
        const startY = pos.y - 10;

        const halfExtents = { x: 4, y: 0.5, z: 4 };
        const amplitude = 20.0;

        // Alternating neon colors for the platforms
        const color = i % 2 === 0 ? [0.0, 1.0, 1.0] : [1.0, 0.0, 0.5];

        // signature: (pos, halfExtents, color, type, center, amplitude)
        zone.createKinematicBox(
            { x: startX, y: startY, z: zOffset },
            halfExtents,
            color,
            'horizontal',
            startX,
            amplitude
        );

        if (zone.movingPlatforms && zone.movingPlatforms.length > 0) {
            zone.movingPlatforms[zone.movingPlatforms.length - 1].speed = 3.0 + (i * 0.5);
        }
    }

    // 4. Gravity Well / Jump Pad
    zone.createJumpZone({ x: pos.x, y: pos.y - 10, z: pos.z + 85 }, {
        width: 12, depth: 12,
        boostForce: 45,
        color: [0.0, 1.0, 0.5] // Neon green boost pad
    });

    // 5. Exit Platform & Goal
    zone.createFloorZone({ x: pos.x, y: pos.y + 10, z: pos.z + 115 }, {
        width: 15, depth: 15, friction: 0.8
    });
    zone.createGoalZone({ x: pos.x, y: pos.y + 10.5, z: pos.z + 115 });

    console.log('[ZONE] Neon City Heights zone created successfully');
}
