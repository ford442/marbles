import { quatFromEuler } from './math.js';

export function createPlinkoObstacleZone(game, offset) {
    const floorQ = { x: 0, y: 0, z: 0, w: 1 };

    // --- Starting Platform ---
    game.createStaticBox(
        { x: offset.x, y: offset.y, z: offset.z },
        floorQ,
        { x: 5, y: 0.5, z: 5 },
        [0.4, 0.4, 0.5],
        'concrete'
    );

    // --- The Plinko Board ---
    // The board is a slanted plane down which the marbles will fall
    const boardWidth = 10;
    const boardLength = 30; // length along the slant
    const boardThickness = 0.5;
    const boardAngle = -0.4; // Pitch downward
    const sinA = Math.sin(boardAngle / 2);
    const cosA = Math.cos(boardAngle / 2);
    const boardQ = { x: sinA, y: 0, z: 0, w: cosA };

    // Position the board so it starts roughly at the edge of the starting platform
    // Center of the board in world coordinates
    const boardCenterZ = offset.z + 5 + (boardLength / 2) * Math.cos(boardAngle);
    const boardCenterY = offset.y - (boardLength / 2) * Math.sin(-boardAngle);

    // Main backboard
    game.createStaticBox(
        { x: offset.x, y: boardCenterY, z: boardCenterZ },
        boardQ,
        { x: boardWidth / 2, y: boardThickness / 2, z: boardLength / 2 },
        [0.8, 0.6, 0.2], // Wood color
        'wood'
    );

    // Side walls to keep marble on the board
    const wallHeight = 2.0;
    const wallThickness = 0.5;

    // Left Wall
    game.createStaticBox(
        { x: offset.x - (boardWidth / 2) - (wallThickness / 2), y: boardCenterY + wallHeight / 2 * Math.cos(boardAngle), z: boardCenterZ + wallHeight / 2 * Math.sin(boardAngle) },
        boardQ,
        { x: wallThickness / 2, y: wallHeight / 2, z: boardLength / 2 },
        [0.6, 0.4, 0.2],
        'wood'
    );
    // Right Wall
    game.createStaticBox(
        { x: offset.x + (boardWidth / 2) + (wallThickness / 2), y: boardCenterY + wallHeight / 2 * Math.cos(boardAngle), z: boardCenterZ + wallHeight / 2 * Math.sin(boardAngle) },
        boardQ,
        { x: wallThickness / 2, y: wallHeight / 2, z: boardLength / 2 },
        [0.6, 0.4, 0.2],
        'wood'
    );

    // Top wall to block marble from going backwards over the edge
     game.createStaticBox(
        { x: offset.x, y: offset.y + wallHeight/2, z: offset.z + 5 - wallThickness/2 },
        floorQ,
        { x: boardWidth/2, y: wallHeight/2, z: wallThickness/2 },
        [0.6, 0.4, 0.2],
        'wood'
     );

    // --- Pegs ---
    // Create a grid of pegs on the board
    const rows = 12;
    const cols = 5;
    const pegSpacingZ = boardLength / (rows + 1);
    const pegSpacingX = (boardWidth - 2) / cols;

    for (let r = 0; r < rows; r++) {
        // Offset every other row
        const offsetRow = r % 2 === 0 ? 0 : pegSpacingX / 2;
        const currentCols = r % 2 === 0 ? cols : cols - 1;

        // Local Z along the board surface
        const localZ = -boardLength / 2 + (r + 1) * pegSpacingZ;

        for (let c = 0; c < currentCols; c++) {
            // Local X across the board width
            const localX = -(boardWidth - 2) / 2 + c * pegSpacingX + offsetRow;

            // Convert local coordinates on the slanted plane to world coordinates
            const worldX = offset.x + localX;
            // The peg stands 'up' relative to the board
            const pegHeight = 1.0;
            const pegThickness = 0.2;

            // To position the peg correctly on the board's surface:
            const worldY = boardCenterY + localZ * Math.sin(boardAngle) + (boardThickness / 2 + pegHeight / 2) * Math.cos(boardAngle);
            const worldZ = boardCenterZ + localZ * Math.cos(boardAngle) - (boardThickness / 2 + pegHeight / 2) * Math.sin(boardAngle);

            game.createStaticBox(
                { x: worldX, y: worldY, z: worldZ },
                boardQ, // Peg is aligned with the board's normal
                { x: pegThickness / 2, y: pegHeight / 2, z: pegThickness / 2 },
                [0.9, 0.9, 0.9],
                'metal'
            );
        }
    }

    // --- Catch Tray ---
    // At the bottom of the board
    const bottomY = boardCenterY + (boardLength / 2) * Math.sin(boardAngle);
    const bottomZ = boardCenterZ + (boardLength / 2) * Math.cos(boardAngle);

    const trayLength = 10;

    // Tray Floor
    game.createStaticBox(
        { x: offset.x, y: bottomY - 0.5, z: bottomZ + trayLength / 2 },
        floorQ,
        { x: boardWidth / 2, y: 0.5, z: trayLength / 2 },
        [0.4, 0.4, 0.5],
        'concrete'
    );

    // Tray Back Wall
    game.createStaticBox(
        { x: offset.x, y: bottomY, z: bottomZ + trayLength },
        floorQ,
        { x: boardWidth / 2, y: 1.0, z: wallThickness / 2 },
        [0.4, 0.4, 0.5],
        'concrete'
    );

    // Tray Side Walls
    game.createStaticBox(
        { x: offset.x - boardWidth / 2 - wallThickness / 2, y: bottomY, z: bottomZ + trayLength / 2 },
        floorQ,
        { x: wallThickness / 2, y: 1.0, z: trayLength / 2 },
        [0.4, 0.4, 0.5],
        'concrete'
    );
    game.createStaticBox(
        { x: offset.x + boardWidth / 2 + wallThickness / 2, y: bottomY, z: bottomZ + trayLength / 2 },
        floorQ,
        { x: wallThickness / 2, y: 1.0, z: trayLength / 2 },
        [0.4, 0.4, 0.5],
        'concrete'
    );

    // Goal platform is added by the level config, positioned at the end of the tray
}
