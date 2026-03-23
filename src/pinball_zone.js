import { quatFromEuler } from './math.js';

export const pinballLevel = {
    name: 'Pinball Wizard',
    description: 'Use the flippers and hit the targets!',
    zones: [
        { type: 'floor', pos: { x: 0, y: -5, z: 0 }, size: { x: 60, y: 0.5, z: 60 } },
        { type: 'pinball', pos: { x: 0, y: 0, z: 0 } },
        { type: 'goal', pos: { x: 0, y: 8, z: -25 } }
    ],
    spawn: { x: 14, y: 5, z: 25 }, // Start in plunger lane
    goals: [
        { id: 1, range: { x: [-2, 2], z: [-27, -23], y: [6, 10] } }
    ],
    camera: { mode: 'follow', height: 25, offset: -20, angle: 0 }
};

export function createPinballZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Table Base (Slanted) ---
    // Angle the table downwards towards the player (positive Z)
    // We want the back (Z-) to be high and front (Z+) to be low.
    // Positive pitch (X rotation) tilts Y+ towards Z+.
    // Negative pitch tilts Y+ towards Z-.
    // So negative pitch makes the normal point slightly backwards (up and back).
    // Wait, if normal points up and back, the surface is tilted forward (down at front).
    // Let's visualize:
    // Normal (0,1,0). Rot X(-45). New Normal (0, 0.7, -0.7). Points up-back.
    // Surface plane equation: 0x + 0.7y - 0.7z = 0.
    // At z=10 (front), 0.7y = 7 => y=10.
    // At z=-10 (back), 0.7y = -7 => y=-10.
    // So Z+ is high, Z- is low.
    // This is opposite of what I want.
    // I want Z- (back) to be high.
    // So I need positive pitch?
    // Normal (0,1,0). Rot X(45). New Normal (0, 0.7, 0.7). Points up-front.
    // Surface: 0.7y + 0.7z = 0.
    // z=10 => 0.7y = -7 => y=-10. Low.
    // z=-10 => 0.7y = 7 => y=10. High.
    // Yes! Positive pitch makes Z- high and Z+ low.

    const slopeAngle = 0.15; // Positive pitch for back-high/front-low
    const tableQ = quatFromEuler(0, slopeAngle, 0);

    const width = 30;
    const length = 60;
    const thickness = 2;

    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        tableQ,
        { x: width / 2, y: thickness / 2, z: length / 2 },
        [0.1, 0.1, 0.2], // Dark blue/purple
        'wood'
    );

    const cos = Math.cos(slopeAngle);
    const sin = Math.sin(slopeAngle);

    // Helper to place objects on the slanted surface
    // x, z are local coordinates relative to the table center (offset)
    // z is along the length (Z- is back/top, Z+ is front/bottom)
    // h, w, d are half-extents
    // y_offset is height above the table surface (default 0 is centered in thickness, usually we want on top)
    const placeOnTable = (x, z, w, h, d, color, mat = 'wood', rotY = 0) => {
        // Local position relative to table center
        // We want the object's bottom to be on the table surface?
        // Or its center to be h above surface?
        // Let's assume h is half-height, so center is h above surface.
        // Surface is at local y = thickness/2.
        const localY = thickness / 2 + h;

        // Rotate (x, localY, z) by slopeAngle around X
        // Standard rotation for positive angle a around X:
        // y' = y*cos(a) - z*sin(a)
        // z' = y*sin(a) + z*cos(a)

        const yRel = localY * cos - z * sin;
        const zRel = localY * sin + z * cos;

        // Final position
        const posX = offset.x + x;
        const posY = offset.y + yRel;
        const posZ = offset.z + zRel;

        // Rotation: We want the object to be perpendicular to the table surface.
        // So we start with the table's orientation (slopeAngle pitch).
        // Then we apply the object's local Y rotation (rotY).
        // Since we are using Euler angles (Yaw, Pitch, Roll),
        // and assuming specific order, we can try combining them.
        // In `quatFromEuler(yaw, pitch, roll)`:
        // Yaw is Y rotation, Pitch is X rotation.
        // If the order is Y then X (intrinsic) or X then Y?
        // The implementation in `math.js`:
        // sr * cp * cy - cr * sp * sy
        // It looks like standard ZYX or something.
        // Let's trust that passing (rotY, slopeAngle, 0) works for simple cases.
        // If the object needs to rotate around its own local Y (which is the table normal),
        // and the table is pitched by X, then (rotY, slopeAngle, 0) should be close enough.

        const q = quatFromEuler(rotY, slopeAngle, 0);

        game.createStaticBox(
            { x: posX, y: posY, z: posZ },
            q,
            { x: w, y: h, z: d },
            color,
            mat
        );
    };

    // --- Walls ---
    const wallHeight = 2;
    const wallThick = 1;
    // Left Wall
    placeOnTable(-width/2 + wallThick/2, 0, wallThick/2, wallHeight/2, length/2, [0.8, 0.2, 0.2]);
    // Right Wall (outer)
    placeOnTable(width/2 - wallThick/2, 0, wallThick/2, wallHeight/2, length/2, [0.8, 0.2, 0.2]);
    // Top Wall
    placeOnTable(0, -length/2 + wallThick/2, width/2, wallHeight/2, wallThick/2, [0.8, 0.2, 0.2]);

    // --- Plunger Lane ---
    const laneWidth = 3;
    const laneWallX = width/2 - wallThick - laneWidth;
    placeOnTable(laneWallX, 5, 0.2, wallHeight/2, length/2 - 5, [0.8, 0.5, 0.2]);

    // --- Flippers (Static for now) ---
    // Left Flipper
    placeOnTable(-5, 15, 3, 0.5, 0.5, [1, 1, 0], 'plastic', -0.5);
    // Right Flipper
    placeOnTable(5, 15, 3, 0.5, 0.5, [1, 1, 0], 'plastic', 0.5);

    // --- Bumpers ---
    // Top bumpers (Cylinders approximated as boxes)
    placeOnTable(-5, -10, 1.5, 0.5, 1.5, [0, 1, 1], 'rubber');
    placeOnTable(5, -10, 1.5, 0.5, 1.5, [0, 1, 1], 'rubber');
    placeOnTable(0, -15, 1.5, 0.5, 1.5, [0, 1, 1], 'rubber');

    // --- Slingshots (Triangular bounce pads above flippers) ---
    placeOnTable(-10, 8, 1, 0.5, 3, [1, 0, 1], 'rubber', 0.3);
    placeOnTable(7, 8, 1, 0.5, 3, [1, 0, 1], 'rubber', -0.3);

    // --- Targets (Dynamic) ---
    for(let i=0; i<3; i++) {
        const x = -10;
        const z = -5 + i * 3;
        const h = 0.5;
        const w = 0.2;
        const d = 0.8;

        const localY = thickness / 2 + h;
        const yRel = localY * cos - z * sin;
        const zRel = localY * sin + z * cos;

        const posX = offset.x + x;
        const posY = offset.y + yRel;
        const posZ = offset.z + zRel;

        const q = quatFromEuler(0, slopeAngle, 0);

        // Note: game.createDynamicBox signature: (pos, rotation, halfExtents, color, density, material, gravityScale)
        game.createDynamicBox(
             { x: posX, y: posY, z: posZ },
             q,
             { x: w, y: h, z: d },
             [1, 0, 0],
             0.5, // density
             'plastic',
             1.0 // gravity
        );
    }
}
