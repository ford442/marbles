import { quatFromEuler } from './math.js';

export function createPlinkoZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Board Base (Slanted almost vertically) ---
    const slopeAngle = Math.PI / 2.5; // Almost vertical, tilted slightly back
    const boardQ = quatFromEuler(0, slopeAngle, 0);

    const width = 30;
    const length = 40;
    const thickness = 2;

    game.createStaticBox(
        { x: offset.x, y: offset.y + length / 2, z: offset.z },
        boardQ,
        { x: width / 2, y: thickness / 2, z: length / 2 },
        [0.1, 0.3, 0.1], // Dark green
        'wood'
    );

    const cos = Math.cos(slopeAngle);
    const sin = Math.sin(slopeAngle);

    // Helper to place objects on the slanted board
    const placeOnBoard = (x, z, w, h, d, color, mat = 'wood', rotY = 0) => {
        const localY = thickness / 2 + h;

        const yRel = localY * cos - z * sin;
        const zRel = localY * sin + z * cos;

        const posX = offset.x + x;
        const posY = offset.y + length / 2 + yRel;
        const posZ = offset.z + zRel;

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
    const wallHeight = 4;
    const wallThick = 1;
    // Left Wall
    placeOnBoard(-width/2 + wallThick/2, 0, wallThick/2, wallHeight/2, length/2, [0.8, 0.2, 0.2]);
    // Right Wall
    placeOnBoard(width/2 - wallThick/2, 0, wallThick/2, wallHeight/2, length/2, [0.8, 0.2, 0.2]);
    // Top Wall
    placeOnBoard(0, -length/2 + wallThick/2, width/2, wallHeight/2, wallThick/2, [0.8, 0.2, 0.2]);

    // --- Pegs (Boxes acting as cylinders) ---
    const rows = 12;
    const cols = 9;
    const xSpacing = width / cols;
    const zSpacing = length / (rows + 1);

    for (let r = 0; r < rows; r++) {
        // Offset alternate rows
        const offsetRow = r % 2 === 0 ? 0 : xSpacing / 2;
        const numCols = r % 2 === 0 ? cols - 1 : cols - 2;

        for (let c = 0; c < numCols; c++) {
            const x = -width/2 + xSpacing + offsetRow + c * xSpacing;
            const z = -length/2 + zSpacing + r * zSpacing;

            placeOnBoard(x, z, 0.4, 1.5, 0.4, [0.9, 0.9, 0.9], 'plastic', Math.PI/4); // Rotate 45deg to act a bit more round
        }
    }

    // --- Collection Tray Dividers (Slots at bottom) ---
    const numSlots = 5;
    const slotSpacing = width / numSlots;

    for (let i = 1; i < numSlots; i++) {
        const x = -width/2 + i * slotSpacing;
        const z = length/2 - 4; // Bottom area
        placeOnBoard(x, z, 0.2, 2, 4, [0.2, 0.2, 0.8], 'wood');
    }

    // --- Landing Pad under the Plinko board ---
    game.createStaticBox(
        { x: offset.x, y: offset.y - 2, z: offset.z + length/2 * sin + 5 }, // Positioned forward and down
        floorQ,
        { x: width/2 + 5, y: 0.5, z: 10 },
        [0.3, 0.3, 0.3],
        'concrete'
    );
}
