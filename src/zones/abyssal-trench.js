import RAPIER from '@dimforge/rapier3d-compat';

export function createAbyssalTrenchZone(zone, offset) {
    const pos = offset;

    // 1. Entrance Platform
    zone.createFloorZone({ x: pos.x, y: pos.y, z: pos.z - 40 }, { width: 10, depth: 10, friction: 0.8 });

    // 2. The Trench Slide (Steep, low friction downward tube)
    // Dark blue ice material for the slide
    const slideMaterial = zone.material.createInstance();
    slideMaterial.setColor3Parameter('baseColor', zone.Filament['RgbType'].sRGB, [0.05, 0.2, 0.4]);
    slideMaterial.setFloatParameter('roughness', 0.1);

    zone.createTrackZone({ x: pos.x, y: pos.y - 10, z: pos.z - 20 }, {
        width: 6,
        length: 30,
        slope: 0.3, // Steep down
        friction: 0.05,
        restitution: 0.2,
        customMaterial: slideMaterial
    });

    // 3. Bioluminescent Kinematic Moving Platforms (The Gap Jump)
    // These platforms oscillate up and down, requiring timing to cross
    for (let i = 0; i < 8; i++) {
        const platZ = pos.z + 5 + i * 8;
        const platY = pos.y - 25;

        // Alternate phase for up/down movement
        const phase = (i % 2 === 0) ? 0 : Math.PI;

        const pOpts = {
            width: 4, depth: 4, height: 1,
            color: [0.1, 0.8, 0.9], // Cyan glow color
            emissive: true, // Make them glow
            friction: 0.8
        };

        const plat = zone.createMovingZone({ x: pos.x, y: platY, z: platZ }, pOpts);

        // Convert to vertical kinematic platform
        zone.movingPlatforms.push({
            rigidBody: plat.rigidBody,
            entity: plat.entity,
            initialPos: { x: pos.x, y: platY, z: platZ },
            axis: 'y',
            speed: 2.0,
            amplitude: 3.0,
            phase: phase
        });
    }

    // 4. Hydro-Vents (Upward Boosters)
    // Simple static floor with an upward impulse trigger (simulated here as a jump pad)
    zone.createJumpZone({ x: pos.x, y: pos.y - 25, z: pos.z + 70 }, {
        width: 8, depth: 8,
        boostForce: 30,
        color: [0.0, 1.0, 0.5]
    });

    // 5. Exit Platform & Goal
    zone.createFloorZone({ x: pos.x, y: pos.y - 15, z: pos.z + 90 }, { width: 15, depth: 15, friction: 0.8 });
    zone.createGoalZone({ x: pos.x, y: pos.y - 14.5, z: pos.z + 90 });

    // --- Environmental Details ---

    // Add decorative coral/rocks along the trench walls
    const coralPositions = [
        { x: pos.x - 10, y: pos.y - 5, z: pos.z - 20 },
        { x: pos.x + 12, y: pos.y - 15, z: pos.z + 10 },
        { x: pos.x - 15, y: pos.y - 20, z: pos.z + 40 },
        { x: pos.x + 10, y: pos.y - 25, z: pos.z + 60 }
    ];

    for (const coral of coralPositions) {
        zone.createBlockZone({ x: coral.x, y: coral.y, z: coral.z }, {
            width: 3, height: 10, depth: 3,
            color: [0.8, 0.3, 0.4], // Pinkish coral
            isStatic: true
        });
    }

    // Add rising bubble particles using ParticleSystem
    if (zone.particleSystem) {
        const bubbleSpots = [
            { x: pos.x - 5, z: pos.z },
            { x: pos.x + 5, z: pos.z + 30 },
            { x: pos.x, z: pos.z + 60 }
        ];

        for (const spot of bubbleSpots) {
            zone.particleSystem.createEmitter({
                pos: { x: spot.x, y: pos.y - 30, z: spot.z },
                rate: 10,
                velocity: { x: 0, y: 3, z: 0 },
                velocitySpread: { x: 1, y: 1, z: 1 },
                params: { buoyancy: 0.5, lifetime: 5.0, size: 0.08, color: [0.4, 0.8, 1.0, 0.3] }
            });
        }
    }

    // --- Volumetric Bioluminescent Shafts + Water Caustics ---
    // Register mid-water biolum lights as shaft sources and caustic sources
    if (zone.volumetricLights) {
        const biolumPositions = [
            { x: pos.x - 20, y: pos.y - 12, z: pos.z - 20, color: [0.2, 0.9, 0.7] },
            { x: pos.x + 20, y: pos.y - 12, z: pos.z + 20, color: [0.3, 0.85, 1.0] },
            { x: pos.x,      y: pos.y - 8,  z: pos.z,      color: [0.4, 1.0, 0.85] },
        ];
        for (const bp of biolumPositions) {
            zone.volumetricLights.addShaftSource({
                pos: { x: bp.x, y: bp.y, z: bp.z },
                color: bp.color,
                intensity: 60000,
                behavior: 'biolumSway',
                spread: 20
            });
        }

        // Caustic ripples projected at floor level
        const causticPositions = [
            { x: pos.x - 10, z: pos.z - 10 },
            { x: pos.x + 15, z: pos.z + 5  },
            { x: pos.x - 5,  z: pos.z + 20 },
        ];
        for (const cp of causticPositions) {
            zone.volumetricLights.addCausticSource({
                pos: { x: cp.x, y: pos.y - 25, z: cp.z },
                color: [0.2, 0.85, 0.9],
                radius: 80,
                behavior: 'biolumSway'
            });
        }
    }

    console.log('[ZONE] Created Abyssal Trench zone');
}
