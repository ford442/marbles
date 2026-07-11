import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export function createStellarForgeZone(zone, offset) {
    const pos = offset;
    const F = zone.game?.Filament || zone.Filament;

    console.log('[ZONE] Creating Stellar Forge zone at', pos);

    // 1. Entrance Platform
    zone.createFloorZone({ x: pos.x, y: pos.y, z: pos.z - 40 }, {
        width: 10, depth: 10, friction: 0.8
    });
    audio.registerBodyMaterial(null, 'concrete');

    // 2. Glowing Low-Friction Slide
    const slideMaterial = zone.material.createInstance();
    slideMaterial.setColor3Parameter('baseColor', F.RgbType.sRGB, [1.0, 0.4, 0.0]); // Orange
    slideMaterial.setFloatParameter('roughness', 0.0);
    // Setting emissive directly if supported, or handled via other means

    zone.createTrackZone({ x: pos.x, y: pos.y - 10, z: pos.z - 15 }, {
        width: 10,
        length: 40,
        slope: 0.3, // Steep slope
        friction: 0.01,
        restitution: 0.1,
        customMaterial: slideMaterial
    });

    // 3. Forge Hammers (Kinematic Moving Platforms moving Y)
    // Placed above the slide or gap
    for (let i = 0; i < 3; i++) {
        const zOffset = pos.z + 10 + (i * 12);
        const startY = pos.y - 20;

        zone.createKinematicBox(
            { x: pos.x, y: startY, z: zOffset },
            { x: 4, y: 2, z: 2 },
            [0.8, 0.1, 0.1], // Red hot hammer
            'vertical',
            startY,
            8.0
        );

        if (zone.movingPlatforms.length > 0) {
            const p = zone.movingPlatforms[zone.movingPlatforms.length - 1];
            p.speed = 3.0 + (i * 0.5);
            p.phase = i * (Math.PI / 2);
            // Optionally, add emissive logic here if supported by createKinematicBox or manually via filament
        }
    }

    // 4. Bouncy Zero-G Anomaly Zone
    // A jump pad that gives a big boost
    zone.createJumpZone({ x: pos.x, y: pos.y - 25, z: pos.z + 55 }, {
        width: 12, depth: 12,
        boostForce: 45, // Big boost
        color: [0.5, 0.0, 1.0] // Purple anomaly
    });

    // 5. Exit Platform + Goal
    zone.createFloorZone({ x: pos.x, y: pos.y - 5, z: pos.z + 85 }, {
        width: 15, depth: 15, friction: 0.8
    });
    // Goal is created in levels.js generally, but we can add an exit path here

    // --- Environmental Details ---
    if (zone.particleSystem) {
        // Embers flying up from the forge
        const emberSpots = [
            { x: pos.x - 8, z: pos.z },
            { x: pos.x + 8, z: pos.z + 30 },
            { x: pos.x, z: pos.z + 60 }
        ];
        for (const spot of emberSpots) {
            zone.particleSystem.createEmitter({
                pos: { x: spot.x, y: pos.y - 35, z: spot.z },
                rate: 25,
                velocity: { x: 0, y: 6.0, z: 0 },
                velocitySpread: { x: 3.0, y: 2.0, z: 3.0 },
                params: {
                    buoyancy: 1.0,
                    lifetime: 4.0,
                    size: 0.15,
                    color: [1.0, 0.3, 0.0, 0.8] // Orange embers
                }
            });
        }
    }

    if (zone.volumetricLights) {
        const forgeFires = [
            { x: pos.x - 15, y: pos.y - 15, z: pos.z + 10, color: [1.0, 0.2, 0.0] },
            { x: pos.x + 15, y: pos.y - 15, z: pos.z + 30, color: [1.0, 0.4, 0.0] },
        ];

        for (const s of forgeFires) {
            zone.volumetricLights.addShaftSource({
                pos: { x: s.x, y: s.y, z: s.z },
                color: s.color,
                intensity: 90000,
                behavior: 'pulse', // Fire pulsing
                spread: 40
            });
        }
    }

    console.log('[ZONE] Stellar Forge zone created successfully');
}
