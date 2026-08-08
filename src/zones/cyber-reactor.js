import { audio } from '../audio.js';

export function createCyberReactorZone(game, offset) {
    const zone = game;
    const pos = offset;
    const F = zone.game?.Filament || zone.Filament;

    console.log('[ZONE] Creating Cyber Reactor zone at', pos);

    // 1. Entrance Platform
    zone.createFloorZone({ x: pos.x, y: pos.y, z: pos.z - 30 }, {
        width: 10, depth: 10, friction: 0.8, color: [0.2, 0.2, 0.2]
    });


    // 2. Icy Low-Friction Track
    const slideMaterial = zone.material.createInstance();
    slideMaterial.setColor3Parameter('baseColor', F.RgbType.sRGB, [0.1, 0.8, 0.9]); // Cyan ice
    slideMaterial.setFloatParameter('roughness', 0.0);

    zone.createTrackZone({ x: pos.x, y: pos.y - 5, z: pos.z }, {
        width: 12,
        length: 40,
        slope: 0.2,
        friction: 0.01,
        restitution: 0.1,
        customMaterial: slideMaterial
    });

    // 3. Cyber Reactor Cores (Kinematic Moving Platforms)
    for (let i = 0; i < 3; i++) {
        const zOffset = pos.z + 30 + (i * 15);
        const startX = pos.x + (i % 2 === 0 ? -12 : 12);
        const startY = pos.y - 12;

        const halfExtents = { x: 5, y: 1, z: 5 };
        const amplitude = 15.0;
        const color = [0.9, 0.1, 0.1]; // Red glowing platforms

        // signature: (pos, halfExtents, color, type, center, amplitude)
        zone.createKinematicBox(
            { x: startX, y: startY, z: zOffset },
            halfExtents,
            color,
            'horizontal',
            startX,
            amplitude
        );

        // Adjust speed for variety
        if (zone.movingPlatforms && zone.movingPlatforms.length > 0) {
            zone.movingPlatforms[zone.movingPlatforms.length - 1].speed = 2.5 + (i * 0.5);
        }
    }

    // 4. Coolant Pool Jump (Jump Pad)
    zone.createJumpZone({ x: pos.x, y: pos.y - 12, z: pos.z + 80 }, {
        width: 10, depth: 10,
        boostForce: 50,
        color: [0.0, 1.0, 0.5] // Neon green
    });

    // 5. Exit Platform & Goal
    zone.createFloorZone({ x: pos.x, y: pos.y + 10, z: pos.z + 110 }, {
        width: 15, depth: 15, friction: 0.8
    });
    zone.createGoalZone({ x: pos.x, y: pos.y + 10.5, z: pos.z + 110 });

    console.log('[ZONE] Cyber Reactor zone created successfully');
}
