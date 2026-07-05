import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createStormPeakZone(zone, offset) {
    const pos = offset;
    const F = zone.game?.Filament || zone.Filament;

    console.log('[ZONE] Creating Storm Peak zone at', pos);

    // 1. Entrance Platform
    zone.createFloorZone({ x: pos.x, y: pos.y, z: pos.z - 40 }, {
        width: 10, depth: 10, friction: 0.8
    });
    audio.registerBodyMaterial(null, 'concrete');

    // 2. Icy Low-Friction Slide
    const slideMaterial = zone.material.createInstance();
    slideMaterial.setColor3Parameter('baseColor', F.RgbType.sRGB, [0.3, 0.4, 0.5]);
    slideMaterial.setFloatParameter('roughness', 0.0);

    zone.createTrackZone({ x: pos.x, y: pos.y - 5, z: pos.z - 20 }, {
        width: 10,
        length: 30,
        slope: 0.25,
        friction: 0.01,
        restitution: 0.1,
        customMaterial: slideMaterial
    });

    // 3. Storm Clouds (Kinematic Moving Platforms)
    for (let i = 0; i < 4; i++) {
        const zOffset = pos.z + 20 + (i * 12);
        const startX = pos.x + (i % 2 === 0 ? -10 : 10);
        const startY = pos.y - 15;

        const hExtents = { x: 4, y: 0.5, z: 4 };
        const amplitude = 12.0;
        const speed = 3.0 + (i * 0.2);

        zone.createKinematicBox(
            { x: startX, y: startY, z: zOffset },
            hExtents,
            [0.2, 0.2, 0.25],
            'horizontal',
            startX,
            amplitude
        );
        // Tweak the speed slightly for variety via direct mutation
        if (zone.movingPlatforms.length > 0) {
            zone.movingPlatforms[zone.movingPlatforms.length - 1].speed = speed;
        }
    }

    // 4. High Wind Updrafts (Jump Pads)
    zone.createJumpZone({ x: pos.x, y: pos.y - 20, z: pos.z + 75 }, {
        width: 12, depth: 12,
        boostForce: 45, // high boost
        color: [1.0, 1.0, 0.0] // Electric yellow
    });

    // 5. Electric Rods (Static obstacles to dodge after the jump)
    const rodPositions = [
        { x: pos.x - 5, y: pos.y + 5, z: pos.z + 85 },
        { x: pos.x + 5, y: pos.y + 5, z: pos.z + 85 },
        { x: pos.x, y: pos.y + 10, z: pos.z + 90 }
    ];

    for (const rod of rodPositions) {
        zone.createBlockZone(rod, {
            width: 2, height: 15, depth: 2,
            color: [1.0, 0.8, 0.0],
            isStatic: true
        });
    }

    // 6. Exit Platform + Goal
    zone.createFloorZone({ x: pos.x, y: pos.y + 15, z: pos.z + 105 }, {
        width: 15, depth: 15, friction: 0.8
    });
    zone.createGoalZone({ x: pos.x, y: pos.y + 15.5, z: pos.z + 105 });

    // --- Environmental Details ---
    if (zone.particleSystem) {
        const stormSpots = [
            { x: pos.x, z: pos.z + 40 },
            { x: pos.x, z: pos.z + 85 }
        ];
        for (const spot of stormSpots) {
            zone.particleSystem.addAmbientEmitter({
                pos: { x: spot.x, y: pos.y - 10, z: spot.z },
                type: 'spark',
                rate: 20,
                count: 1,
                spread: 5.0,
                velocity: { x: 0, y: 1.0, z: 0 },
                velocitySpread: { x: 5.0, y: 0.5, z: 5.0 },
                params: {
                    buoyancy: -0.2, // Rain falls down
                    lifetime: 3.0,
                    size: 0.05,
                    color: [0.6, 0.6, 0.8, 0.5]
                }
            });
        }
    }

    if (zone.volumetricLights) {
        const lightningFlashes = [
            { x: pos.x - 20, y: pos.y + 10, z: pos.z + 40, color: [0.8, 0.9, 1.0] },
            { x: pos.x + 20, y: pos.y + 20, z: pos.z + 60, color: [0.9, 1.0, 1.0] },
        ];

        for (const s of lightningFlashes) {
            zone.volumetricLights.addShaftSource({
                pos: { x: s.x, y: s.y, z: s.z },
                color: s.color,
                intensity: 80000,
                behavior: 'pulse', // simulate lightning flashes if possible
                spread: 30
            });
        }
    }

    console.log('[ZONE] Storm Peak zone created successfully');
}
