import { audio } from '../audio.js';

export function createNeonVortexZone(game, offset) {
    const pos = offset;
    const zone = game;
    const F = zone.game?.Filament || zone.Filament;

    console.log('[ZONE] Creating Neon Vortex zone at', pos);

    // 1. Entrance Ramp (Low-Friction Ice)
    // Entrance
    zone.createStaticBox(
        { x: pos.x, y: pos.y, z: pos.z },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 5, y: 0.5, z: 5 },
        [0.2, 0.2, 0.2],
        'concrete'
    );

    // Low friction slide
    const angle = 0.2; // roughly 11.4 degrees
    const sinA = Math.sin(angle / 2);
    const cosA = Math.cos(angle / 2);
    const q = { x: sinA, y: 0, z: 0, w: cosA };

    zone.createStaticBox(
        { x: pos.x, y: pos.y - 2, z: pos.z + 10 },
        q,
        { x: 5, y: 0.5, z: 10 },
        [0.1, 0.9, 0.9],
        'glass'
    );

    // 2. The Vortex (Kinematic Rotating Platforms)
    const vortexCenterZ = pos.z + 30;
    const vortexCenterY = pos.y - 8;

    // Central static hub
    zone.createStaticBox(
        { x: pos.x, y: vortexCenterY, z: vortexCenterZ },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 2, y: 0.5, z: 2 },
        [0.8, 0.1, 0.8],
        'metal'
    );

    for (let i = 0; i < 4; i++) {
        const hExtents = { x: 4, y: 0.5, z: 2 };
        const angleOffset = (Math.PI / 2) * i;
        const distance = 8;
        const platformPosX = pos.x + Math.cos(angleOffset) * distance;
        const platformPosZ = vortexCenterZ + Math.sin(angleOffset) * distance;

        zone.createKinematicBox(
            { x: platformPosX, y: vortexCenterY, z: platformPosZ },
            hExtents,
            [0.1, 0.8, 0.9],
            'horizontal',
            platformPosX,
            5
        );

        if (zone.movingPlatforms && zone.movingPlatforms.length > 0) {
            zone.movingPlatforms[zone.movingPlatforms.length - 1].speed = 1.0;
        }
    }

    // 3. Exit Platform & Jump
    zone.createStaticBox(
        { x: pos.x, y: vortexCenterY - 1, z: vortexCenterZ + 15 },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 6, y: 0.5, z: 4 },
        [0.4, 0.4, 0.4],
        'concrete'
    );

    const rampAngle = -0.4;
    const rSin = Math.sin(rampAngle / 2);
    const rCos = Math.cos(rampAngle / 2);
    const rq = { x: rSin, y: 0, z: 0, w: rCos };

    zone.createStaticBox(
        { x: pos.x, y: vortexCenterY + 1.0, z: vortexCenterZ + 20 },
        rq,
        { x: 6, y: 0.25, z: 3 },
        [1.0, 0.5, 0.0],
        'wood'
    );

    zone.createStaticBox(
        { x: pos.x, y: vortexCenterY - 2, z: vortexCenterZ + 35 },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 8, y: 0.5, z: 5 },
        [0.3, 0.7, 0.3],
        'wood'
    );

    // Goal
    zone.createStaticBox(
        { x: pos.x, y: vortexCenterY - 1, z: vortexCenterZ + 38 },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 1, y: 0.5, z: 1 },
        [0.8, 0.8, 0.2],
        'metal'
    );

    console.log('[ZONE] Neon Vortex zone created successfully');
}
