export function createNeonHologramZone(game, offset) {
    const zone = game;
    const pos = offset;
    const F = zone.game?.Filament || zone.Filament;

    console.log('[ZONE] Creating Neon Hologram zone at', pos);

    // 1. Entrance Platform
    zone.createFloorZone({ x: pos.x, y: pos.y, z: pos.z - 10 }, {
        width: 10, depth: 10, friction: 0.8, color: [0.05, 0.05, 0.15]
    });

    // 2. Icy Low-Friction Hologram Track
    const slideMaterial = zone.material.createInstance();
    slideMaterial.setColor3Parameter('baseColor', F.RgbType.sRGB, [0.0, 1.0, 0.8]); // Cyan hologram ice
    slideMaterial.setFloatParameter('roughness', 0.0);

    zone.createTrackZone({ x: pos.x, y: pos.y - 5, z: pos.z + 15 }, {
        width: 12,
        length: 40,
        slope: 0.15,
        friction: 0.0,
        restitution: 0.1,
        customMaterial: slideMaterial
    });

    // 3. Sweeping Holographic Blockers (Kinematic Moving Platforms)
    for (let i = 0; i < 4; i++) {
        const zOffset = pos.z + 5 + (i * 10);
        const startX = pos.x + (i % 2 === 0 ? -8 : 8);
        const startY = pos.y - 3 - (i * 1.5);

        const halfExtents = { x: 4, y: 1, z: 1 };
        const amplitude = 12.0;
        const color = [1.0, 0.0, 1.0]; // Magenta glowing blockers

        // signature: (pos, halfExtents, color, type, center, amplitude)
        zone.createKinematicBox(
            { x: startX, y: startY, z: zOffset },
            halfExtents,
            color,
            'horizontal',
            pos.x, // Sweep relative to the track's center X
            amplitude
        );

        // Adjust speed for variety
        if (zone.movingPlatforms && zone.movingPlatforms.length > 0) {
            zone.movingPlatforms[zone.movingPlatforms.length - 1].speed = 3.0 + (i * 0.5);
        }
    }

    // 4. Energy Updraft (Jump Pad)
    zone.createJumpZone({ x: pos.x, y: pos.y - 12, z: pos.z + 45 }, {
        width: 10, depth: 10,
        boostForce: 45,
        color: [0.0, 1.0, 0.0] // Neon green
    });

    // 5. Exit Platform
    zone.createFloorZone({ x: pos.x, y: pos.y + 10, z: pos.z + 75 }, {
        width: 15, depth: 15, friction: 0.8, color: [0.05, 0.05, 0.15]
    });

    console.log('[ZONE] Neon Hologram zone created successfully');
}
