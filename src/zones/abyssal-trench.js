import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createAbyssalTrenchZone(zone, offset) {
    const pos = offset;
    const F = zone.game?.Filament || zone.Filament; // support both patterns if needed

    console.log('[ZONE] Creating Abyssal Trench zone at', pos);

    // 1. Entrance Platform
    zone.createFloorZone({ x: pos.x, y: pos.y, z: pos.z - 40 }, { 
        width: 10, depth: 10, friction: 0.8 
    });
    audio.registerBodyMaterial(null, 'concrete');

    // 2. Icy Low-Friction Slide
    const slideMaterial = zone.material.createInstance();
    slideMaterial.setColor3Parameter('baseColor', F.RgbType.sRGB, [0.0, 0.1, 0.3]);
    slideMaterial.setFloatParameter('roughness', 0.0);

    zone.createTrackZone({ x: pos.x, y: pos.y - 3, z: pos.z - 20 }, {
        width: 10,
        length: 30,
        slope: 0.2,
        friction: 0.01,
        restitution: 0.2,
        customMaterial: slideMaterial
    });

    // 3. Bioluminescent Kinematic Moving Platforms (Gap Jump)
    for (let i = 0; i < 3; i++) {
        const zOffset = pos.z + 45 + (i * 10);
        const startY = pos.y - 12;
        const color = i % 2 === 0 ? [0.1, 1.0, 0.5] : [0.1, 0.5, 1.0];

        const plat = zone.createMovingZone({ 
            x: pos.x, 
            y: startY, 
            z: zOffset 
        }, {
            width: 6, depth: 6, height: 1,
            color,
            emissive: true,
            friction: 0.5
        });

        zone.movingPlatforms.push({
            rigidBody: plat.rigidBody,
            entity: plat.entity,
            initialPos: { x: pos.x, y: startY, z: zOffset },
            axis: 'y',           // or 'horizontal' if you prefer x/z movement
            speed: 2.0 + (i * 0.5),
            amplitude: 6.0,
            phase: i * Math.PI
        });
    }

    // 4. Hydro-Vents (Jump Pads)
    zone.createJumpZone({ x: pos.x, y: pos.y - 25, z: pos.z + 70 }, {
        width: 8, depth: 8,
        boostForce: 30,
        color: [0.0, 1.0, 0.5]
    });

    // 5. Exit Platform + Goal
    zone.createFloorZone({ x: pos.x, y: pos.y - 12, z: pos.z + 90 }, { 
        width: 15, depth: 15, friction: 0.8 
    });
    zone.createGoalZone({ x: pos.x, y: pos.y - 11.5, z: pos.z + 90 });

    // --- Environmental Details ---
    const coralPositions = [
        { x: pos.x - 10, y: pos.y - 5, z: pos.z - 20 },
        { x: pos.x + 12, y: pos.y - 15, z: pos.z + 10 },
        { x: pos.x - 15, y: pos.y - 20, z: pos.z + 40 },
        { x: pos.x + 10, y: pos.y - 25, z: pos.z + 60 }
    ];

    for (const coral of coralPositions) {
        zone.createBlockZone(coral, {
            width: 3, height: 10, depth: 3,
            color: [0.8, 0.3, 0.4],
            isStatic: true
        });
    }

    // Rising Bubbles
    if (zone.particleSystem) {
        const bubbleSpots = [
            { x: pos.x - 5, z: pos.z },
            { x: pos.x + 5, z: pos.z + 30 },
            { x: pos.x, z: pos.z + 60 }
        ];
        for (const spot of bubbleSpots) {
            zone.particleSystem.createEmitter({
                pos: { x: spot.x, y: pos.y - 30, z: spot.z },
                rate: 12,
                velocity: { x: 0, y: 3.5, z: 0 },
                velocitySpread: { x: 1.2, y: 1.5, z: 1.2 },
                params: { 
                    buoyancy: 0.6, 
                    lifetime: 6.0, 
                    size: 0.09, 
                    color: [0.4, 0.85, 1.0, 0.35] 
                }
            });
        }
    }

    // Volumetric Bioluminescent Shafts + Caustics
    if (zone.volumetricLights) {
        const shaftSources = [
            { x: pos.x - 20, y: pos.y - 12, z: pos.z - 20, color: [0.2, 0.9, 0.7] },
            { x: pos.x + 20, y: pos.y - 12, z: pos.z + 20, color: [0.3, 0.85, 1.0] },
            { x: pos.x, y: pos.y - 8, z: pos.z, color: [0.4, 1.0, 0.85] },
        ];

        for (const s of shaftSources) {
            zone.volumetricLights.addShaftSource({
                pos: { x: s.x, y: s.y, z: s.z },
                color: s.color,
                intensity: 65000,
                behavior: 'biolumSway',
                spread: 22
            });
        }

        // Caustics on the trench floor
        const causticSpots = [
            { x: pos.x - 10, z: pos.z - 10 },
            { x: pos.x + 15, z: pos.z + 5 },
            { x: pos.x - 5, z: pos.z + 20 },
        ];
        for (const c of causticSpots) {
            zone.volumetricLights.addCausticSource({
                pos: { x: c.x, y: pos.y - 25, z: c.z },
                color: [0.2, 0.85, 0.9],
                radius: 85,
                behavior: 'biolumSway'
            });
        }
    }

    console.log('[ZONE] Abyssal Trench zone created successfully');
}