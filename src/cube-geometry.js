const qTop = [-0.70710678, 0, 0, 0.70710678];
const qBottom = [0.70710678, 0, 0, 0.70710678];
const qRight = [0, -0.70710678, 0, 0.70710678];
const qLeft = [0, 0.70710678, 0, 0.70710678];
const qFront = [0, 0, 0, 1];
const qBack = [0, 1, 0, 0];

// UV coordinates for each vertex (per face)
const uv00 = [0, 0];
const uv10 = [1, 0];
const uv11 = [1, 1];
const uv01 = [0, 1];

export const CUBE_VERTICES = new Float32Array([
    // Front face
    -0.5, -0.5, 0.5, ...qFront, ...uv00,
    0.5, -0.5, 0.5, ...qFront, ...uv10,
    0.5, 0.5, 0.5, ...qFront, ...uv11,
    -0.5, 0.5, 0.5, ...qFront, ...uv01,
    // Back face
    -0.5, -0.5, -0.5, ...qBack, ...uv00,
    -0.5, 0.5, -0.5, ...qBack, ...uv10,
    0.5, 0.5, -0.5, ...qBack, ...uv11,
    0.5, -0.5, -0.5, ...qBack, ...uv01,
    // Top face
    -0.5, 0.5, -0.5, ...qTop, ...uv00,
    -0.5, 0.5, 0.5, ...qTop, ...uv10,
    0.5, 0.5, 0.5, ...qTop, ...uv11,
    0.5, 0.5, -0.5, ...qTop, ...uv01,
    // Bottom face
    -0.5, -0.5, -0.5, ...qBottom, ...uv00,
    0.5, -0.5, -0.5, ...qBottom, ...uv10,
    0.5, -0.5, 0.5, ...qBottom, ...uv11,
    -0.5, -0.5, 0.5, ...qBottom, ...uv01,
    // Right face
    0.5, -0.5, -0.5, ...qRight, ...uv00,
    0.5, 0.5, -0.5, ...qRight, ...uv10,
    0.5, 0.5, 0.5, ...qRight, ...uv11,
    0.5, -0.5, 0.5, ...qRight, ...uv01,
    // Left face
    -0.5, -0.5, -0.5, ...qLeft, ...uv00,
    -0.5, -0.5, 0.5, ...qLeft, ...uv10,
    -0.5, 0.5, 0.5, ...qLeft, ...uv11,
    -0.5, 0.5, -0.5, ...qLeft, ...uv01
]);

export const CUBE_INDICES = new Uint16Array([
    0, 1, 2, 2, 3, 0,
    4, 5, 6, 6, 7, 4,
    8, 9, 10, 10, 11, 8,
    12, 13, 14, 14, 15, 12,
    16, 17, 18, 18, 19, 16,
    20, 21, 22, 22, 23, 20
]);
