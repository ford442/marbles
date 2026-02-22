import RAPIER from '@dimforge/rapier3d-compat';
import { createSphere } from './sphere.js';
import { audio } from './audio.js';

// --- LEVEL DEFINITIONS ---
const LEVELS = {
    tutorial: {
        name: 'Tutorial Ramp',
        description: 'Learn the basics on a simple ramp',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 32.5 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [30.5, 34.5], y: [0, 2] } }
        ],
        camera: { mode: 'orbit', angle: 0, height: 10, radius: 25 }
    },
    landing: {
        name: 'Landing Zone',
        description: 'Navigate around pillars',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 32.5 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [30.5, 34.5], y: [0, 2] } }
        ],
        camera: { mode: 'orbit', angle: 0, height: 12, radius: 30 }
    },
    jump: {
        name: 'The Jump',
        description: 'Make the big leap!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 80 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'jump', pos: { x: 0, y: 0, z: 37.5 } },
            { type: 'goal', pos: { x: 0, y: -1.4, z: 63 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [61, 65], y: [-3, -1] } }
        ],
        camera: { mode: 'follow', height: 12, offset: -20 }
    },
    slalom: {
        name: 'Slalom Challenge',
        description: 'Weave through the pillars',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 120 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'slalom', pos: { x: 0, y: -2, z: 85 } },
            { type: 'goal', pos: { x: 0, y: -1.4, z: 100 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [98, 102], y: [-2, 0] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    staircase: {
        name: 'Stairway to Heaven',
        description: 'Climb the steps to victory',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 80, y: 0.5, z: 180 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'slalom', pos: { x: 0, y: -2, z: 85 } },
            { type: 'checkpoint', pos: { x: 0, y: -1.5, z: 110 }, size: { x: 10, y: 4, z: 2 } },
            { type: 'staircase', pos: { x: 0, y: -2, z: 110 } },
            { type: 'goal', pos: { x: 0, y: 9, z: 154 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-3, 3], z: [152, 156], y: [7, 15] } }
        ],
        camera: { mode: 'follow', height: 18, offset: -30 }
    },
    full_course: {
        name: 'Full Course',
        description: 'The complete challenge - all zones!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 50 }, size: { x: 100, y: 0.5, z: 200 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'landing', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 32.5 }, color: [1, 0.84, 0] },
            { type: 'jump', pos: { x: 0, y: 0, z: 37.5 } },
            { type: 'slalom', pos: { x: 0, y: -2, z: 85 } },
            { type: 'goal', pos: { x: 0, y: -1.4, z: 100 }, color: [1, 0.84, 0] },
            { type: 'staircase', pos: { x: 0, y: -2, z: 110 } },
            { type: 'goal', pos: { x: 0, y: 9, z: 154 }, color: [1, 0.5, 0] }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [30.5, 34.5], y: [0, 2] } },
            { id: 2, range: { x: [-2, 2], z: [98, 102], y: [-2, 0] } },
            { id: 3, range: { x: [-3, 3], z: [152, 156], y: [7, 15] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    sandbox: {
        name: 'Sandbox',
        description: 'Open area to test all marbles',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 100, y: 0.5, z: 100 } }
        ],
        spawn: { x: 0, y: 5, z: 0 },
        goals: [],
        camera: { mode: 'orbit', angle: 0, height: 15, radius: 40 }
    },
    crystal_orchard: {
        name: 'Crystal Orchard',
        description: 'Night falls on the glowing fruit trees',
        zones: [
            { type: 'orchard', center: { x: 0, y: -2, z: 0 }, radius: 60 }
        ],
        spawn: { x: 0, y: 3, z: 0 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [50, 60], y: [0, 10] } }
        ],
        camera: { mode: 'orbit', angle: 0, height: 20, radius: 50 },
        nightMode: true,
        backgroundColor: [0.02, 0.02, 0.08, 1.0]
    },
    spiral_madness: {
        name: 'Spiral Madness',
        description: 'Dizzying heights!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 100, y: 0.5, z: 100 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'spiral', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 3.8, y: 18.7, z: 25.8 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
             { id: 1, range: { x: [1, 7], z: [23, 29], y: [16, 20] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    zigzag: {
        name: 'ZigZag Challenge',
        description: 'Sharp turns ahead!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'zigzag', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: -2, z: 80 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-5, 5], z: [78, 82], y: [-5, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    neon_dash: {
        name: 'Neon Dash',
        description: 'Race through the glowing city!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 60, y: 0.5, z: 100 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'neon_city', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 4, z: 90 }, color: [0.0, 1.0, 1.0] }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-3, 3], z: [88, 92], y: [2, 6] } }
        ],
        camera: { mode: 'follow', height: 12, offset: -20 },
        nightMode: true,
        backgroundColor: [0.05, 0.05, 0.1, 1.0]
    },
    loop_challenge: {
        name: 'Loop-the-Loop',
        description: 'Defy gravity!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'loop', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 60 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [58, 62], y: [0, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    block_challenge: {
        name: 'Block Challenge',
        description: 'Navigate through the obstacle course',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'block', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 50 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [48, 52], y: [0, 2] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    bowling_alley: {
        name: 'Bowling Alley',
        description: 'Knock down the pins!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'bowling', pos: { x: 0, y: 0, z: 25 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 55 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-10, 10], z: [53, 57], y: [0, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    },
    castle_siege: {
        name: 'Castle Siege',
        description: 'Storm the castle!',
        zones: [
            { type: 'floor', pos: { x: 0, y: -2, z: 0 }, size: { x: 50, y: 0.5, z: 50 } },
            { type: 'track', pos: { x: 0, y: 3, z: 0 } },
            { type: 'castle', pos: { x: 0, y: 0, z: 35 } },
            { type: 'goal', pos: { x: 0, y: 0.25, z: 65 } }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-2, 2], z: [63, 67], y: [0, 5] } }
        ],
        camera: { mode: 'follow', height: 15, offset: -25 }
    }
};

// --- HELPER: Math for Transforms ---
function quatFromEuler(yaw, pitch, roll) {
    const cy = Math.cos(yaw * 0.5), sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5), sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5), sr = Math.sin(roll * 0.5);
    return {
        x: sr * cp * cy - cr * sp * sy,
        y: cr * sp * cy + sr * cp * sy,
        z: cr * cp * sy - sr * sp * cy,
        w: cr * cp * cy + sr * sp * sy
    };
}

function quaternionToMat4(position, quaternion) {
    const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    return new Float32Array([
        1 - (yy + zz), xy + wz, xz - wy, 0,
        xy - wz, 1 - (xx + zz), yz + wx, 0,
        xz + wy, yz - wx, 1 - (xx + yy), 0,
        position.x, position.y, position.z, 1
    ]);
}

// --- HELPER: Raw Cube Data (Vertices + Tangents) ---
const qTop = [-0.70710678, 0, 0, 0.70710678];
const qBottom = [0.70710678, 0, 0, 0.70710678];
const qRight = [0, -0.70710678, 0, 0.70710678];
const qLeft = [0, 0.70710678, 0, 0.70710678];
const qFront = [0, 0, 0, 1];
const qBack = [0, 1, 0, 0];

const CUBE_VERTICES = new Float32Array([
    -0.5, -0.5, 0.5, ...qFront,
    0.5, -0.5, 0.5, ...qFront,
    0.5, 0.5, 0.5, ...qFront,
    -0.5, 0.5, 0.5, ...qFront,
    -0.5, -0.5, -0.5, ...qBack,
    -0.5, 0.5, -0.5, ...qBack,
    0.5, 0.5, -0.5, ...qBack,
    0.5, -0.5, -0.5, ...qBack,
    -0.5, 0.5, -0.5, ...qTop,
    -0.5, 0.5, 0.5, ...qTop,
    0.5, 0.5, 0.5, ...qTop,
    0.5, 0.5, -0.5, ...qTop,
    -0.5, -0.5, -0.5, ...qBottom,
    0.5, -0.5, -0.5, ...qBottom,
    0.5, -0.5, 0.5, ...qBottom,
    -0.5, -0.5, 0.5, ...qBottom,
    0.5, -0.5, -0.5, ...qRight,
    0.5, 0.5, -0.5, ...qRight,
    0.5, 0.5, 0.5, ...qRight,
    0.5, -0.5, 0.5, ...qRight,
    -0.5, -0.5, -0.5, ...qLeft,
    -0.5, -0.5, 0.5, ...qLeft,
    -0.5, 0.5, 0.5, ...qLeft,
    -0.5, 0.5, -0.5, ...qLeft
]);

const CUBE_INDICES = new Uint16Array([
    0, 1, 2, 2, 3, 0,
    4, 5, 6, 6, 7, 4,
    8, 9, 10, 10, 11, 8,
    12, 13, 14, 14, 15, 12,
    16, 17, 18, 18, 19, 16,
    20, 21, 22, 22, 23, 20
]);

async function loadFilament() {
    // Wait for Filament to be loaded globally via script tag
    let attempts = 0;
    while (typeof Filament === 'undefined' && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 10));
        attempts++;
    }

    console.log('[INIT] Filament available after', attempts, 'attempts:', typeof Filament);
    if (typeof Filament === 'undefined') {
        throw new Error('Filament not loaded. Make sure filament.js is included as a script tag.');
    }

    // Initialize Filament if needed
    if (typeof Filament.init === 'function' && !Filament.isReady) {
        await new Promise(resolve => Filament.init([], resolve));
    }

    // Load extensions
    if (Filament.loadGeneratedExtensions) Filament.loadGeneratedExtensions();
    if (Filament.loadClassExtensions) Filament.loadClassExtensions();

    console.log('[INIT] Filament loaded globally:', typeof Filament, Object.keys(Filament || {}).slice(0, 10));
    return Filament;
}

class MarblesGame {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.marbles = [];
        this.staticBodies = []; // Track for cleanup
        this.staticEntities = []; // Track for cleanup
        this.dynamicObjects = []; // Track for cleanup (pins, dominos, etc)
        this.checkpoints = []; // Track active checkpoints
        this.collectibles = [];
        this.collectibleRotation = 0;
        this.powerUps = [];
        this.activeEffects = { speed: 0, jump: 0 };
        this.movingPlatforms = [];
        this.Filament = null;
        this.material = null;
        this.cubeMesh = null;

        // Camera State
        this.camAngle = 0;
        this.camHeight = 10;
        this.camRadius = 25;

        // Input State
        this.keys = {};

        // Camera Control Mode
        this.cameraMode = 'orbit';

        // Game State
        this.score = 0;
        this.scoreEl = document.getElementById('score');
        this.levelNameEl = document.getElementById('level-name');
        this.selectedEl = document.getElementById('selected');
        this.aimEl = document.getElementById('aim');
        this.powerbarEl = document.getElementById('powerbar');
        this.jumpBarEl = document.getElementById('jumpbar');
        this.boostBarEl = document.getElementById('boostbar');
        this.effectEl = document.getElementById('effects');
        this.currentMarbleIndex = 0;
        this.aimYaw = 0;
        this.jumpCharge = 0;
        this.lastBoostTime = 0;
        this.boostCooldown = 3000;
        this.isChargingJump = false;
        this.pitchAngle = 0;
        this.chargePower = 0;
        this.charging = false;
        this.isAiming = false;
        this.playerMarble = null;
        this.cueInst = null;

        // Level State
        this.currentLevel = null;
        this.levelStartTime = 0;
        this.levelComplete = false;
        this.goalDefinitions = [];
    }

    // ... keep initMouseControls, isGrounded, init, showLevelSelection, loadLevel from feature branch ...

    clearLevel() {
        // Remove all marbles
        for (const m of this.marbles) {
            this.world.removeRigidBody(m.rigidBody);
            this.scene.remove(m.entity);
            this.engine.destroyEntity(m.entity);
        }
        this.marbles = [];
        this.playerMarble = null;

        // Remove all static bodies
        for (const body of this.staticBodies) {
            this.world.removeRigidBody(body);
        }
        this.staticBodies = [];

        // Remove all static entities
        for (const entity of this.staticEntities) {
            this.scene.remove(entity);
            this.engine.destroyEntity(entity);
        }
        this.staticEntities = [];

        // Remove all dynamic objects (pins, blocks, etc)
        for (const obj of this.dynamicObjects) {
            this.world.removeRigidBody(obj.rigidBody);
            this.scene.remove(obj.entity);
            this.engine.destroyEntity(obj.entity);
        }
        this.dynamicObjects = [];

        // Remove all checkpoints
        for (const cp of this.checkpoints) {
            this.scene.remove(cp.entity);
            this.engine.destroyEntity(cp.entity);
        }
        this.checkpoints = [];

        // Remove all collectibles (from feature)
        for (const c of this.collectibles) {
            this.scene.remove(c.entity);
            this.engine.destroyEntity(c.entity);
        }
        this.collectibles = [];

        // Remove all powerups (from main)
        for (const p of this.powerUps) {
            this.scene.remove(p.entity);
            this.engine.destroyEntity(p.entity);
        }
        this.powerUps = [];

        // Remove all moving platforms (from main)
        for (const platform of this.movingPlatforms) {
            this.world.removeRigidBody(platform.rigidBody);
            this.scene.remove(platform.entity);
            this.engine.destroyEntity(platform.entity);
        }
        this.movingPlatforms = [];

        // Reset lighting to day mode
        this.setNightMode(false);
    }

    async createZone(zone) {
        const pos = zone.pos || { x: 0, y: 0, z: 0 };
        const offset = { x: pos.x, y: pos.y, z: pos.z };

        switch (zone.type) {
            case 'floor':
                this.createFloorZone(offset, zone.size);
                break;
            case 'track':
                this.createTrackZone(offset);
                break;
            case 'landing':
                this.createLandingZone(offset);
                break;
            case 'jump':
                this.createJumpZone(offset);
                break;
            case 'slalom':
                this.createSlalomZone(offset);
                break;
            case 'staircase':
                this.createStaircaseZone(offset);
                break;
            case 'split':
                this.createSplitZone(offset);
                break;
            case 'forest':
                this.createForestZone(offset);
                break;
            case 'goal':
                this.createGoalZone(offset, zone.color);
                break;
            case 'orchard':
                this.createOrchardZone(zone.center, zone.radius);
                break;
            case 'spiral':
                this.createSpiralZone(offset);
                break;
            case 'zigzag':
                this.createZigZagZone(offset);
                break;
            case 'neon_city':
                this.createNeonCityZone(offset);
                break;
            case 'loop':
                this.createLoopZone(offset);
                break;
            case 'block':
                this.createBlockZone(offset);
                break;
            case 'bowling':
                this.createBowlingZone(offset);
                break;
            case 'checkpoint':
                this.createCheckpointZone(offset, zone.size);
                break;
            case 'castle':
                this.createCastleZone(offset);
                break;
        }
    }

    createCheckpointZone(offset, size) {
        const sz = size || { x: 10, y: 5, z: 2 };
        const center = { x: offset.x, y: offset.y + sz.y / 2, z: offset.z };
        const q = { x: 0, y: 0, z: 0, w: 1 };

        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();

        // Checkpoint inactive: Cyan [0, 1, 1]
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
        matInstance.setFloatParameter('roughness', 0.1);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [sz.x / 2, sz.y / 2, sz.z / 2] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, entity);

        const tcm = this.engine.getTransformManager();
        const inst = tcm.getInstance(entity);

        const mat = quaternionToMat4(center, q);
        mat[0] *= sz.x; mat[1] *= sz.x; mat[2] *= sz.x;
        mat[4] *= sz.y; mat[5] *= sz.y; mat[6] *= sz.y;
        mat[8] *= sz.z; mat[9] *= sz.z; mat[10] *= sz.z;

        tcm.setTransform(inst, mat);
        this.scene.addEntity(entity);

        // Track as checkpoint (no physics body, just visual + logic)
        this.checkpoints.push({
            pos: center,
            halfExtents: { x: sz.x / 2, y: sz.y / 2, z: sz.z / 2 },
            entity: entity,
            matInstance: matInstance,
            activated: false
        });
    }

    createFloorZone(offset, size) {
        const sz = size || { x: 50, y: 0.5, z: 50 };
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            { x: 0, y: 0, z: 0, w: 1 },
            { x: sz.x / 2, y: sz.y / 2, z: sz.z / 2 },
            [0.3, 0.3, 0.3],
            'concrete'  // Solid concrete floor
        );
    }

    createTrackZone(offset) {
        const angle = 0.2;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const q = { x: sinA, y: 0, z: 0, w: cosA };

        // Main ramp (smooth wood)
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            q,
            { x: 4, y: 0.2, z: 15 },
            [0.6, 0.6, 0.6],
            'wood'
        );

        // Side walls (wood)
        this.createStaticBox(
            { x: offset.x - 3.5, y: offset.y + 1, z: offset.z },
            q,
            { x: 0.5, y: 1.5, z: 15 },
            [0.5, 0.3, 0.3],
            'wood'
        );
        this.createStaticBox(
            { x: offset.x + 3.5, y: offset.y + 1, z: offset.z },
            q,
            { x: 0.5, y: 1.5, z: 15 },
            [0.5, 0.3, 0.3],
            'wood'
        );
    }

    createSpiralZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Base platform
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 4 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        const numSteps = 60;
        const radius = 10;
        const heightGain = 0.3;
        const angleStep = 0.2;

        for (let i = 0; i < numSteps; i++) {
            const angle = i * angleStep;
            const x = offset.x + Math.cos(angle) * radius;
            const z = offset.z + 10 + Math.sin(angle) * radius;
            const y = offset.y + i * heightGain;

            // Yaw rotation to follow the spiral curve
            const rotY = -angle;
            // Pitch rotation to bank/slope up slightly
            const pitch = -0.2;

            const q = quatFromEuler(rotY, pitch, 0);

            this.createStaticBox(
                { x: x, y: y, z: z },
                q,
                { x: 1.5, y: 0.2, z: 1 },
                [0.3 + (i / numSteps) * 0.5, 0.3, 0.6],
                'wood'
            );
        }

        // Top platform
        const lastAngle = (numSteps - 1) * angleStep;
        const lastX = offset.x + Math.cos(lastAngle) * radius;
        const lastZ = offset.z + 10 + Math.sin(lastAngle) * radius;
        const lastY = offset.y + (numSteps - 1) * heightGain;

        this.createStaticBox(
             { x: lastX, y: lastY, z: lastZ },
             floorQ,
             { x: 3, y: 0.5, z: 3 },
             [0.8, 0.8, 0.2],
             'metal'
        );
    }

    createBlockZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Floor
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 10, y: 0.5, z: 20 },
            [0.5, 0.5, 0.5],
            'concrete'
        );

        // Blocks
        for (let i = 0; i < 30; i++) {
            // Deterministic placement
            const x = offset.x + (Math.sin(i * 12.9898) * 8);
            const z = offset.z + (Math.cos(i * 78.233) * 18);
            const h = 1.0 + (i % 3) * 0.5;

            this.createStaticBox(
                { x: x, y: offset.y + h/2, z: z },
                floorQ,
                { x: 0.5, y: h/2, z: 0.5 },
                [0.7, 0.3, 0.3], // Reddish blocks
                'concrete'
            );
        }
    }

    createLoopZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Approach ramp
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 3, y: 0.5, z: 5 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        const radius = 15;
        const segments = 32;
        const centerX = offset.x;
        const centerY = offset.y + radius;
        const centerZ = offset.z + 5 + radius;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // Angle 0 at bottom.
            const theta = angle - Math.PI / 2;

            // Helical offset to avoid collision at end
            const xShift = (i / segments) * 4;
            const x = centerX + xShift;

            const y = centerY + Math.sin(theta) * radius;
            const z = centerZ + Math.cos(theta) * radius;

            // Rotation around X axis to match tangent
            const alpha = -(theta + Math.PI/2);
            const sinA = Math.sin(alpha / 2);
            const cosA = Math.cos(alpha / 2);
            const q = { x: sinA, y: 0, z: 0, w: cosA };

            const segmentLength = (2 * Math.PI * radius / segments);

            // Track segment
            this.createStaticBox(
                { x: x, y: y, z: z },
                q,
                { x: 2, y: 0.2, z: segmentLength / 2 + 0.1 },
                [0.8, 0.2 + (i/segments)*0.8, 0.2],
                'metal'
            );

             // Side walls
             this.createStaticBox(
                { x: x - 2.2, y: y, z: z },
                q,
                { x: 0.2, y: 1.0, z: segmentLength / 2 + 0.1 },
                [0.6, 0.6, 0.6],
                'metal'
             );
             this.createStaticBox(
                { x: x + 2.2, y: y, z: z },
                q,
                { x: 0.2, y: 1.0, z: segmentLength / 2 + 0.1 },
                [0.6, 0.6, 0.6],
                'metal'
             );
        }

        // Exit ramp (shifted by 4 units due to helix)
        this.createStaticBox(
            { x: offset.x + 4, y: offset.y, z: offset.z + 5 + radius * 2 + 5 },
            floorQ,
            { x: 3, y: 0.5, z: 5 },
            [0.4, 0.4, 0.4],
            'concrete'
        );
    }

    createZigZagZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Start platform
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 3, y: 0.5, z: 3 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        // ZigZag segments
        // Segment 1: Forward
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z + 8 },
            floorQ,
            { x: 1, y: 0.5, z: 5 },
            [0.7, 0.3, 0.3], // Reddish
            'wood'
        );

        // Segment 2: Right turn
        this.createStaticBox(
            { x: offset.x + 4, y: offset.y, z: offset.z + 13 },
            { x: 0, y: 0.3826834, z: 0, w: 0.9238795 }, // ~45 deg
            { x: 1, y: 0.5, z: 5 },
            [0.3, 0.7, 0.3], // Greenish
            'wood'
        );

        // Segment 3: Left turn
         this.createStaticBox(
            { x: offset.x + 4, y: offset.y, z: offset.z + 21 },
             { x: 0, y: -0.3826834, z: 0, w: 0.9238795 }, // ~-45 deg
            { x: 1, y: 0.5, z: 5 },
            [0.3, 0.3, 0.7], // Blueish
            'wood'
        );

         // Segment 4: Forward again
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z + 30 },
            floorQ,
            { x: 1, y: 0.5, z: 5 },
            [0.7, 0.7, 0.3], // Yellowish
            'wood'
        );

        // End platform
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z + 38 },
            floorQ,
            { x: 3, y: 0.5, z: 3 },
            [0.4, 0.4, 0.4],
            'concrete'
        );
    }

    createNeonCityZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };
        const buildingColors = [
            [0.0, 1.0, 1.0], // Cyan
            [1.0, 0.0, 1.0], // Magenta
            [0.7, 1.0, 0.0], // Lime
            [1.0, 0.5, 0.0]  // Orange
        ];

        // Base path
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 4, y: 0.5, z: 5 },
            [0.1, 0.1, 0.2],
            'concrete'
        );

        // City Run
        for (let i = 0; i < 15; i++) {
            const z = offset.z + 8 + i * 4;
            // Pseudo-random x: -3 or 3 based on i
            const side = (i % 2 === 0) ? 1 : -1;
            const x = offset.x + side * 3.5;

            // Pseudo-random height
            const h = 1.5 + Math.abs(Math.sin(i * 12.9898)) * 2.5;
            const color = buildingColors[i % buildingColors.length];

            // The building (obstacle)
            this.createStaticBox(
                { x: x, y: offset.y + h/2, z: z },
                floorQ,
                { x: 1.5, y: h/2, z: 1.5 },
                color,
                'metal'
            );

            // The floor path in the center
            this.createStaticBox(
                { x: offset.x, y: offset.y, z: z },
                floorQ,
                { x: 2, y: 0.5, z: 2 },
                [0.1, 0.1, 0.2],
                'concrete'
            );
        }

        // Ramp
        const rampZ = offset.z + 72;
        const angle = -0.35; // Steep ramp
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

        this.createStaticBox(
            { x: offset.x, y: offset.y + 1.5, z: rampZ },
            rampQ,
            { x: 2, y: 0.2, z: 5 },
            [1.0, 0.0, 0.5],
            'wood'
        );

        // Landing pad
        this.createStaticBox(
            { x: offset.x, y: offset.y + 2, z: rampZ + 12 },
            floorQ,
            { x: 3, y: 0.5, z: 5 },
            [0.2, 0.2, 0.4],
            'concrete'
        );
    }

    createLandingZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Floor (concrete)
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 5, y: 0.25, z: 10 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        // Pillars (metal)
        this.createStaticBox(
            { x: offset.x - 3, y: offset.y + 1.5, z: offset.z - 5 },
            floorQ,
            { x: 0.5, y: 1.5, z: 0.5 },
            [0.8, 0.2, 0.2],
            'metal'
        );
        this.createStaticBox(
            { x: offset.x + 3, y: offset.y + 1.5, z: offset.z },
            floorQ,
            { x: 0.5, y: 1.5, z: 0.5 },
            [0.2, 0.2, 0.8],
            'metal'
        );
        this.createStaticBox(
            { x: offset.x, y: offset.y + 0.75, z: offset.z + 5 },
            floorQ,
            { x: 2, y: 0.5, z: 0.5 },
            [0.2, 0.8, 0.2],
            'metal'
        );
    }

    createBowlingZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Lane Dimensions
        const laneWidth = 4;
        const laneLength = 25;
        const laneThickness = 0.5;

        // Lane Surface (Wood)
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: laneWidth / 2, y: laneThickness / 2, z: laneLength / 2 },
            [0.8, 0.6, 0.4],
            'wood'
        );

        // Gutters (Lower and to the side)
        const gutterWidth = 1.0;
        this.createStaticBox(
            { x: offset.x - (laneWidth/2 + gutterWidth/2), y: offset.y - 0.2, z: offset.z },
            floorQ,
            { x: gutterWidth / 2, y: laneThickness / 2, z: laneLength / 2 },
            [0.3, 0.3, 0.3],
            'concrete'
        );
        this.createStaticBox(
            { x: offset.x + (laneWidth/2 + gutterWidth/2), y: offset.y - 0.2, z: offset.z },
            floorQ,
            { x: gutterWidth / 2, y: laneThickness / 2, z: laneLength / 2 },
            [0.3, 0.3, 0.3],
            'concrete'
        );

        // Side Bumpers (Walls)
        this.createStaticBox(
            { x: offset.x - (laneWidth/2 + gutterWidth + 0.2), y: offset.y + 0.5, z: offset.z },
            floorQ,
            { x: 0.2, y: 1.0, z: laneLength / 2 },
            [0.5, 0.5, 0.5],
            'metal'
        );
        this.createStaticBox(
            { x: offset.x + (laneWidth/2 + gutterWidth + 0.2), y: offset.y + 0.5, z: offset.z },
            floorQ,
            { x: 0.2, y: 1.0, z: laneLength / 2 },
            [0.5, 0.5, 0.5],
            'metal'
        );

        // Pins (Dynamic Boxes)
        // Standard 10-pin setup
        const pinSize = { x: 0.15, y: 0.5, z: 0.15 };
        const pinSpacing = 0.6; // 60cm spacing
        const startZ = offset.z + laneLength / 2 - 2; // Near the end

        // Row 1 (1 pin)
        this.createDynamicBox(
            { x: offset.x, y: offset.y + pinSize.y + 0.1, z: startZ },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );

        // Row 2 (2 pins)
        this.createDynamicBox(
            { x: offset.x - pinSpacing/2, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x + pinSpacing/2, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );

        // Row 3 (3 pins)
        this.createDynamicBox(
            { x: offset.x - pinSpacing, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 2 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 2 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x + pinSpacing, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 2 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );

        // Row 4 (4 pins)
        this.createDynamicBox(
            { x: offset.x - pinSpacing * 1.5, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 3 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x - pinSpacing * 0.5, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 3 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x + pinSpacing * 0.5, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 3 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );
        this.createDynamicBox(
            { x: offset.x + pinSpacing * 1.5, y: offset.y + pinSize.y + 0.1, z: startZ + pinSpacing * 3 },
            floorQ, pinSize, [1, 1, 1], 0.8, 'wood'
        );

        // Backstop (to catch pins)
        this.createStaticBox(
             { x: offset.x, y: offset.y + 1, z: offset.z + laneLength/2 + 2 },
             floorQ,
             { x: laneWidth/2 + gutterWidth + 0.5, y: 2, z: 0.5 },
             [0.2, 0.2, 0.2],
             'metal'
        );
    }

    createCastleZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Castle Grounds
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 15, y: 0.5, z: 25 },
            [0.4, 0.4, 0.35], // Dirty ground
            'concrete'
        );

        // Walls
        const wallHeight = 3;
        const wallThick = 0.5;
        const wallColor = [0.5, 0.5, 0.55]; // Stone grey

        // Left Wall
        this.createStaticBox(
            { x: offset.x - 10, y: offset.y + wallHeight/2, z: offset.z },
            floorQ,
            { x: wallThick, y: wallHeight/2, z: 25 },
            wallColor,
            'concrete'
        );
        // Right Wall
        this.createStaticBox(
            { x: offset.x + 10, y: offset.y + wallHeight/2, z: offset.z },
            floorQ,
            { x: wallThick, y: wallHeight/2, z: 25 },
            wallColor,
            'concrete'
        );

        // Gatehouse
        const gateZ = offset.z + 15;
        // Left Tower
        this.createStaticBox(
            { x: offset.x - 4, y: offset.y + 3, z: gateZ },
            floorQ,
            { x: 2, y: 3, z: 2 },
            wallColor,
            'concrete'
        );
        // Right Tower
        this.createStaticBox(
            { x: offset.x + 4, y: offset.y + 3, z: gateZ },
            floorQ,
            { x: 2, y: 3, z: 2 },
            wallColor,
            'concrete'
        );
        // Archway Top
        this.createStaticBox(
            { x: offset.x, y: offset.y + 5, z: gateZ },
            floorQ,
            { x: 2, y: 1, z: 1 },
            wallColor,
            'concrete'
        );

        // Drawbridge (Ramp)
        const rampAngle = -0.2;
        const sinA = Math.sin(rampAngle / 2);
        const cosA = Math.cos(rampAngle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

        this.createStaticBox(
             { x: offset.x, y: offset.y + 1, z: gateZ - 6 },
             rampQ,
             { x: 2, y: 0.2, z: 4 },
             [0.4, 0.25, 0.1], // Wood
             'wood'
        );

        // Crates (Dynamic obstacles) inside
        for (let i = 0; i < 10; i++) {
            const cx = offset.x + (Math.random() * 8 - 4);
            const cz = offset.z + (Math.random() * 10 - 5);
            this.createDynamicBox(
                { x: cx, y: offset.y + 1.5, z: cz },
                floorQ,
                { x: 0.5, y: 0.5, z: 0.5 },
                [0.6, 0.4, 0.2],
                0.5,
                'wood'
            );
        }
    }

    createJumpZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Approach (concrete)
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 5, y: 0.25, z: 2.5 },
            [0.4, 0.4, 0.4],
            'concrete'
        );

        // Ramp (wood)
        const angle = -0.4;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = { x: sinA, y: 0, z: 0, w: cosA };
        this.createStaticBox(
            { x: offset.x, y: offset.y + 1.0, z: offset.z + 5 },
            rampQ,
            { x: 5, y: 0.25, z: 3 },
            [0.7, 0.3, 0.3],
            'wood'
        );

        // Landing (soft foam-like, use wood as closest)
        this.createStaticBox(
            { x: offset.x, y: offset.y - 2, z: offset.z + 22.5 },
            floorQ,
            { x: 8, y: 0.5, z: 5 },
            [0.3, 0.7, 0.3],
            'wood'
        );

        // Target (metal)
        this.createStaticBox(
            { x: offset.x, y: offset.y - 1, z: offset.z + 25.5 },
            floorQ,
            { x: 1, y: 0.5, z: 1 },
            [0.8, 0.8, 0.2],
            'metal'
        );
    }

    createSlalomZone(offset) {
        const floorQ = { x: 0, y: 0, z: 0, w: 1 };

        // Floor (concrete)
        this.createStaticBox(
            { x: offset.x, y: offset.y, z: offset.z },
            floorQ,
            { x: 6, y: 0.5, z: 20 },
            [0.3, 0.3, 0.5],
            'concrete'
        );

        // Pillars - metal cones (relative to offset)
        for (let z = -15; z <= 15; z += 5) {
            if (z === 15) continue;
            const pillarX = ((z + 15) / 5) % 2 === 0 ? 3 : -3;
            this.createStaticBox(
                { x: offset.x + pillarX, y: offset.y + 2, z: offset.z + z },
                floorQ,
                { x: 0.5, y: 1.5, z: 0.5 },
                [0.9, 0.1, 0.1],
                'metal'
            );
        }
    }

    createMarbles(spawnPos) {
        const baseSpawn = spawnPos || { x: 0, y: 8, z: -12 };

        const marblesInfo = [
            { name: "Red Classic", color: [1.0, 0.0, 0.0], offset: { x: -1.0, y: 0, z: 0 } },
            { name: "Blue Classic", color: [0.0, 0.0, 1.0], offset: { x: 1.0, y: 0, z: 0 } },
            { name: "Green Flash", color: [0.2, 1.0, 0.2], offset: { x: -2.5, y: 4, z: 0 }, radius: 0.4, friction: 0.1, restitution: 0.8, roughness: 0.2 },
            { name: "Purple Haze", color: [0.6, 0.1, 0.8], offset: { x: 0.0, y: 2, z: 2 }, radius: 0.75, restitution: 1.2 },
            { name: "Golden Orb", color: [1.0, 0.84, 0.0], offset: { x: 2.5, y: 2, z: 2 }, radius: 0.6, restitution: 0.2, density: 3.0, roughness: 0.3 },
            { name: "Cyan Surfer", color: [0.0, 0.8, 1.0], offset: { x: -2.0, y: 2, z: 2 }, radius: 0.5, friction: 0.05, restitution: 0.5, roughness: 0.1 },
            // --- NEW MARBLES ---
            { name: "Volcanic Magma", color: [1.0, 0.25, 0.0], offset: { x: 3.5, y: 3, z: 0 }, radius: 0.55, friction: 0.15, restitution: 1.5, density: 0.8, roughness: 0.6 },
            { name: "Shadow Ninja", color: [0.15, 0.05, 0.25], offset: { x: -3.5, y: 3, z: 0 }, radius: 0.45, friction: 0.02, restitution: 0.3, density: 1.2, roughness: 0.05 },
            { name: "Cosmic Nebula", color: [0.3, 0.9, 0.7], offset: { x: 0.0, y: 5, z: -2 }, radius: 0.65, friction: 0.08, restitution: 0.7, density: 1.5, roughness: 0.15 },
            { name: "Void Heavy", color: [0.1, 0.05, 0.2], offset: { x: 2.0, y: 5, z: -2 }, radius: 0.7, friction: 1.0, restitution: 0.1, density: 4.0, roughness: 0.9 },
            { name: "Ice Slick", color: [0.8, 0.9, 1.0], offset: { x: -5.0, y: 3, z: 0 }, radius: 0.48, friction: 0.005, restitution: 0.8, density: 0.9, roughness: 0.1 },
            { name: "Super Bouncy", color: [1.0, 0.0, 0.8], offset: { x: 5.0, y: 3, z: 0 }, radius: 0.52, friction: 0.5, restitution: 1.8, density: 0.5, roughness: 0.3 },
            { name: "Mud Sticky", color: [0.35, 0.25, 0.2], offset: { x: 0.0, y: 3, z: 4 }, radius: 0.5, friction: 2.0, restitution: 0.0, density: 3.0, roughness: 0.9 },
            { name: "Tiny Dense", color: [1.0, 1.0, 1.0], offset: { x: 3.5, y: 3, z: 4 }, radius: 0.3, density: 10.0, friction: 0.1, restitution: 0.5 },
            { name: "Nano", color: [1.0, 0.4, 0.7], offset: { x: 1.5, y: 4, z: 4 }, radius: 0.25, density: 2.0, roughness: 0.2 },
            { name: "Giant", color: [0.2, 0.8, 0.2], offset: { x: -3.0, y: 4, z: 4 }, radius: 1.2, density: 0.5, friction: 0.5, roughness: 0.8 },
            { name: "Mercury", color: [0.7, 0.7, 0.7], offset: { x: -5.0, y: 3, z: 4 }, radius: 0.55, density: 5.0, friction: 0.05, restitution: 0.2, roughness: 0.1 }
        ];

        for (const info of marblesInfo) {
            const radius = info.radius || 0.5;
            const scale = radius / 0.5;
            const pos = {
                x: baseSpawn.x + info.offset.x,
                y: baseSpawn.y + info.offset.y,
                z: baseSpawn.z + info.offset.z
            };

            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(pos.x, pos.y, pos.z)
                .setCanSleep(false);
            const rigidBody = this.world.createRigidBody(bodyDesc);

            const colliderDesc = RAPIER.ColliderDesc.ball(radius)
                .setRestitution(info.restitution !== undefined ? info.restitution : 0.5);

            if (info.density) colliderDesc.setDensity(info.density);
            if (info.friction !== undefined) colliderDesc.setFriction(info.friction);

            this.world.createCollider(colliderDesc, rigidBody);

            const entity = this.Filament.EntityManager.get().create();
            const matInstance = this.material.createInstance();
            matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, info.color);
            matInstance.setFloatParameter('roughness', info.roughness !== undefined ? info.roughness : 0.4);

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
                .material(0, matInstance)
                .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.sphereVb, this.sphereIb)
                .build(this.engine, entity);

            this.scene.addEntity(entity);

            this.marbles.push({
                name: info.name || `Marble ${this.marbles.length + 1}`,
                rigidBody,
                entity,
                scale,
                initialPos: pos,
                respawnPos: { ...pos },
                scoredGoals: new Set()
            });
        }

        this.currentMarbleIndex = 0;
        this.playerMarble = this.marbles[0];
        this.selectedEl.textContent = `Selected: ${this.playerMarble.name}`;
    }

    getLeader() {
        let maxZ = -Infinity;
        let leader = null;
        for (const m of this.marbles) {
            const t = m.rigidBody.translation();
            if (t.z > maxZ) {
                maxZ = t.z;
                leader = m;
            }
        }
        return leader;
    }

    resetMarbles() {
        // Stop all rolling sounds
        audio.stopAllRolling();

        for (const m of this.marbles) {
            m.rigidBody.setTranslation(m.initialPos, true);
            m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
            m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
            m.scoredGoals.clear();
            m.respawnPos = { ...m.initialPos };
        }

        // Reset checkpoints
        for (const cp of this.checkpoints) {
            cp.activated = false;
            if (cp.matInstance) {
                cp.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0]);
            }
        }

        this.score = 0;
        this.scoreEl.textContent = 'Score: 0';
        this.currentMarbleIndex = 0;
        this.playerMarble = this.marbles[0];
        this.selectedEl.textContent = `Selected: ${this.playerMarble ? this.playerMarble.name : 'None'}`;
        this.aimYaw = 0;
        this.chargePower = 0;
        this.charging = false;
        this.powerbarEl.style.width = '0%';
        this.levelComplete = false;
    }

    returnToMenu() {
        audio.stopAllRolling();
        this.clearLevel();
        this.showLevelSelection();
    }

    processCollisionEvents() {
        if (!this.world) return;

        // Track which collisions we've already processed this frame
        const processedCollisions = new Set();

        // Track which marbles are touching surfaces for rolling sounds
        const touchingSurfaces = new Map(); // marbleIndex -> { material, speed }

        for (let i = 0; i < this.marbles.length; i++) {
            const marble = this.marbles[i];
            const rb = marble.rigidBody;
            const velocity = rb.linvel();
            const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
            const angVel = rb.angvel();
            const angularSpeed = Math.hypot(angVel.x, angVel.y, angVel.z);

            // Check if marble is touching any surfaces using intersection testing
            const radius = marble.scale * 0.5 || 0.5;
            const pos = rb.translation();

            // Cast a small downward ray to detect ground/surface contact
            const rayOrigin = { x: pos.x, y: pos.y, z: pos.z };
            const rayDir = { x: 0, y: -1, z: 0 };
            const ray = new RAPIER.Ray(rayOrigin, rayDir);
            const maxToi = radius + 0.1; // Slightly beyond marble radius

            const hit = this.world.castRay(ray, maxToi, true);
            if (hit) {
                const otherCollider = hit.collider;
                const otherBody = otherCollider.parent();

                if (otherBody && otherBody !== rb) {
                    // Check if it's a static body (surface)
                    if (otherBody.bodyType() === RAPIER.RigidBodyType.Fixed) {
                        const material = audio.getMaterial(otherBody.handle);

                        // Track for rolling sound
                        touchingSurfaces.set(i, { material, speed, angularSpeed, radius });

                        // Play impact sound for significant collisions (on first contact)
                        const collisionId = `${rb.handle}-${otherBody.handle}`;
                        if (!processedCollisions.has(collisionId) && speed > 2.5) {
                            processedCollisions.add(collisionId);
                            audio.playSurfaceHit(speed, radius, material, `surface-${rb.handle}`);
                        }
                    }
                }
            }
        }

        // Update rolling sounds
        for (let i = 0; i < this.marbles.length; i++) {
            const marbleId = `marble-${i}`;
            const surfaceInfo = touchingSurfaces.get(i);

            if (surfaceInfo && surfaceInfo.speed > 0.3) {
                // Start or update rolling sound
                const rollingId = `${marbleId}-rolling`;
                if (!audio.rollingSounds || !audio.rollingSounds.has(rollingId)) {
                    audio.startRolling(rollingId, surfaceInfo.radius, surfaceInfo.material);
                }
                audio.updateRolling(rollingId, surfaceInfo.speed, surfaceInfo.angularSpeed);
            } else {
                // Stop rolling sound if not touching or too slow
                audio.stopRolling(`${marbleId}-rolling`);
            }
        }
    }

    checkGameLogic() {
        if (!this.currentLevel || this.levelComplete) return;

        // Reset jump count if grounded and not moving up too fast
        if (this.playerMarble && this.isGrounded(this.playerMarble)) {
            const linvel = this.playerMarble.rigidBody.linvel();
            if (linvel.y <= 0.1) {
                this.jumpCount = 0;
            }
        }

        const level = LEVELS[this.currentLevel];
        let allGoalsScored = level.goals.length > 0;

        for (const m of this.marbles) {
            const t = m.rigidBody.translation();

            // Respawn logic
            if (t.y < -20) {
                const respawn = m.respawnPos || m.initialPos;
                m.rigidBody.setTranslation(respawn, true);
                m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
                m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
                m.scoredGoals.clear();
                continue;
            }

            // Check checkpoints
            for (const cp of this.checkpoints) {
                if (cp.activated) continue;

                // Simple AABB overlap check
                // Checkpoint is centered at cp.pos with halfExtents cp.halfExtents
                // Marble is at t with radius m.scale * 0.5
                const radius = m.scale * 0.5 || 0.5;

                const minX = cp.pos.x - cp.halfExtents.x;
                const maxX = cp.pos.x + cp.halfExtents.x;
                const minZ = cp.pos.z - cp.halfExtents.z;
                const maxZ = cp.pos.z + cp.halfExtents.z;
                const minY = cp.pos.y - cp.halfExtents.y;
                const maxY = cp.pos.y + cp.halfExtents.y;

                if (t.x + radius > minX && t.x - radius < maxX &&
                    t.z + radius > minZ && t.z - radius < maxZ &&
                    t.y + radius > minY && t.y - radius < maxY) {

                    cp.activated = true;
                    // Visual feedback: Green
                    if (cp.matInstance) {
                        cp.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 0.0]);
                    }
                    // Audio feedback
                    audio.playGoal();

                    // Update respawn for THIS marble
                    // Spawn slightly above the checkpoint center to avoid clipping
                    m.respawnPos = { x: cp.pos.x, y: cp.pos.y + 1.0, z: cp.pos.z };

                    console.log(`[GAME] Checkpoint activated by ${m.name}! New respawn set.`);
                }
            }

            // Check goals
            for (const goal of this.goalDefinitions) {
                if (!m.scoredGoals.has(goal.id) &&
                    t.x > goal.range.x[0] && t.x < goal.range.x[1] &&
                    t.z > goal.range.z[0] && t.z < goal.range.z[1] &&
                    t.y > goal.range.y[0] && t.y < goal.range.y[1]) {

                    m.scoredGoals.add(goal.id);
                    this.score++;
                    this.scoreEl.textContent = 'Score: ' + this.score;

                    // Play goal sound (only for first few to avoid spam)
                    if (this.score <= 5) {
                        audio.playGoal();
                    }
                }
            }
        }

        // Check if all goals scored by any marble
        for (const goal of level.goals) {
            let goalScored = false;
            for (const m of this.marbles) {
                if (m.scoredGoals.has(goal.id)) {
                    goalScored = true;
                    break;
                }
            }
            if (!goalScored) {
                allGoalsScored = false;
                break;
            }
        }

        // Collision Scoring (player hits others)
        if (this.playerMarble) {
            const pt = this.playerMarble.rigidBody.translation();
            const pv = this.playerMarble.rigidBody.linvel();
            for (const other of this.marbles) {
                if (other === this.playerMarble) continue;
                const ot = other.rigidBody.translation();
                const ov = other.rigidBody.linvel();
                const dx = pt.x - ot.x;
                const dy = pt.y - ot.y;
                const dz = pt.z - ot.z;
                const dist = Math.hypot(dx, dy, dz);
                if (dist < 1.0) {
                    const relSpeed = Math.hypot(pv.x - ov.x, pv.y - ov.y, pv.z - ov.z);
                    if (relSpeed > 4) {
                        this.score += Math.floor(relSpeed / 3);
                        this.scoreEl.innerText = `Score: ${this.score}`;

                        // Play marble clink sound (velocity-based volume, size-based pitch)
                        const playerRadius = this.playerMarble.scale * 0.5 || 0.5;
                        const otherRadius = other.scale * 0.5 || 0.5;
                        audio.playClink(relSpeed, playerRadius, `player-${this.currentMarbleIndex}`);
                        audio.playClink(relSpeed * 0.7, otherRadius, `other-${this.marbles.indexOf(other)}`);

                        // Bonus push
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const nz = dz / dist;
                        other.rigidBody.applyImpulse({ x: nx * 6, y: ny * 2 + 2, z: nz * 6 }, true);
                    }
                }
            }
        }

        if (allGoalsScored && !this.levelComplete) {
            this.levelComplete = true;
            const time = ((Date.now() - this.levelStartTime) / 1000).toFixed(1);
            setTimeout(() => {
                alert(`Level Complete!\nTime: ${time}s\nPress M to return to menu`);
            }, 100);
        }
    }

    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Set canvas display size (CSS)
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        // Set canvas internal resolution
        this.canvas.width = width;
        this.canvas.height = height;

        console.log(`[RESIZE] Canvas: ${width}x${height}`);

        if (this.view && this.camera) {
            this.view.setViewport([0, 0, width, height]);
            const aspect = width / height;
            const Fov = this.Filament.Camera$Fov;
            this.camera.setProjectionFov(45, aspect, 0.1, 1000.0, Fov.VERTICAL);
            this.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0]);
        }
    }

    loop() {
        // Debug: Log first few frames
        if (!this.frameCount) this.frameCount = 0;
        this.frameCount++;
        if (this.frameCount <= 3) {
            console.log(`[RENDER] Frame ${this.frameCount}, Level: ${this.currentLevel || 'menu'}, Marbles: ${this.marbles.length}`);
        }

        // Update debug overlay (every 10 frames)
        if (this.frameCount % 10 === 0) {
            const debugOverlay = document.getElementById('debug-overlay');
            if (debugOverlay && this.currentLevel) {
                debugOverlay.style.display = 'block';
                document.getElementById('debug-level').textContent = this.currentLevel;
                document.getElementById('debug-marbles').textContent = this.marbles.length;
                document.getElementById('debug-camera').textContent = this.cameraMode;
            }
        }

        const rotSpeed = 0.02;
        const zoomSpeed = 0.5;

        // Handle input
        if (this.keys['KeyR']) {
            this.resetMarbles();
        }
        if (this.keys['KeyM'] && this.currentLevel) {
            this.returnToMenu();
        }

        // Audio controls
        if (this.keys['BracketLeft']) {
            const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4;
            audio.setVolume(currentVol - 0.1);
            this.keys['BracketLeft'] = false;
        }
        if (this.keys['BracketRight']) {
            const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4;
            audio.setVolume(currentVol + 0.1);
            this.keys['BracketRight'] = false;
        }
        if (this.keys['KeyN']) {
            audio.init();
            const muted = audio.toggleMute();
            if (this.muteBtn) {
                this.muteBtn.textContent = muted ? '🔇' : '🔊';
                this.muteBtn.classList.toggle('muted', muted);
            }
            this.keys['KeyN'] = false;
        }

        // Camera and movement controls
        if (this.cameraMode === 'orbit') {
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.camAngle -= rotSpeed;
            if (this.keys['ArrowRight'] || this.keys['KeyD']) this.camAngle += rotSpeed;
            if (this.keys['ArrowUp'] || this.keys['KeyW']) this.camRadius = Math.max(5, this.camRadius - zoomSpeed);
            if (this.keys['ArrowDown'] || this.keys['KeyS']) this.camRadius = Math.min(100, this.camRadius + zoomSpeed);
        } else {
            const impulseStrength = 0.5;
            if (this.playerMarble) {
                const rigidBody = this.playerMarble.rigidBody;
                if (this.keys['ArrowUp'] || this.keys['KeyW']) rigidBody.applyImpulse({ x: 0, y: 0, z: impulseStrength }, true);
                if (this.keys['ArrowDown'] || this.keys['KeyS']) rigidBody.applyImpulse({ x: 0, y: 0, z: -impulseStrength }, true);
                if (this.keys['ArrowLeft'] || this.keys['KeyA']) rigidBody.applyImpulse({ x: -impulseStrength, y: 0, z: 0 }, true);
                if (this.keys['ArrowRight'] || this.keys['KeyD']) rigidBody.applyImpulse({ x: impulseStrength, y: 0, z: 0 }, true);
            }
        }

        // Handle Boost
        const now = Date.now();
        if ((this.keys['ShiftLeft'] || this.keys['ShiftRight']) && now - this.lastBoostTime > this.boostCooldown) {
            if (this.playerMarble) {
                this.lastBoostTime = now;
                audio.playBoost();

                let dirX = 0, dirZ = 0;
                if (this.cameraMode === 'follow') {
                    dirX = Math.sin(this.aimYaw);
                    dirZ = Math.cos(this.aimYaw);
                } else {
                    const vel = this.playerMarble.rigidBody.linvel();
                    const speed = Math.hypot(vel.x, vel.z);
                    if (speed > 0.1) {
                        dirX = vel.x / speed;
                        dirZ = vel.z / speed;
                    } else {
                        dirX = 0;
                        dirZ = 1;
                    }
                }

                const boostForce = 80.0;
                this.playerMarble.rigidBody.applyImpulse({ x: dirX * boostForce, y: 0, z: dirZ * boostForce }, true);
            }
        }

        // Update Jump Charge
        if (this.isChargingJump) {
            this.jumpCharge = Math.min(1.0, this.jumpCharge + 0.03);
            if (this.jumpBarEl) this.jumpBarEl.style.width = `${this.jumpCharge * 100}%`;
        }

        // Update Shot Charge
        if (this.charging) {
            this.chargePower = Math.min(1.0, this.chargePower + 0.015);
        }

        // Update Boost Bar
        const boostProgress = Math.min(1.0, (now - this.lastBoostTime) / this.boostCooldown);
        if (this.boostBarEl) {
            this.boostBarEl.style.width = `${boostProgress * 100}%`;
            this.boostBarEl.style.backgroundColor = boostProgress >= 1.0 ? '#0ff' : '#555';
            this.boostBarEl.style.filter = boostProgress >= 1.0 ? 'brightness(1.2) drop-shadow(0 0 5px #f0f)' : 'brightness(0.7)';
        }

        // Update UI
        const yawDeg = Math.round(this.aimYaw * 180 / Math.PI);
        const pitchDeg = Math.round(this.pitchAngle * 180 / Math.PI);
        this.aimEl.textContent = `Yaw: ${yawDeg}° Pitch: ${pitchDeg}°`;
        this.powerbarEl.style.width = `${this.chargePower * 100}%`;

        // Update Camera
        if (this.cameraMode === 'follow' && this.currentLevel) {
            const level = LEVELS[this.currentLevel];
            const target = this.playerMarble || this.getLeader();
            if (target) {
                const t = target.rigidBody.translation();
                const height = level?.camera?.height || 10;
                const dist = 20;
                const eyeX = t.x - Math.sin(this.aimYaw) * dist;
                const eyeZ = t.z - Math.cos(this.aimYaw) * dist;
                this.camera.lookAt([eyeX, t.y + height, eyeZ], [t.x, t.y, t.z], [0, 1, 0]);
            }
        } else {
            const eyeX = this.camRadius * Math.sin(this.camAngle);
            const eyeZ = this.camRadius * Math.cos(this.camAngle);
            this.camera.lookAt([eyeX, this.camHeight, eyeZ], [0, 0, 0], [0, 1, 0]);
        }

        // Update Collectibles (from feature branch)
        this.collectibleRotation += 0.05;
        if (this.collectibles && this.collectibles.length > 0) {
            const tcm = this.engine.getTransformManager();
            for (let i = this.collectibles.length - 1; i >= 0; i--) {
                const c = this.collectibles[i];

                // Animate: Rotate + Bob up and down
                const bobOffset = Math.sin(this.collectibleRotation * 2) * 0.2;
                const newY = c.baseY + bobOffset;
                const q = quatFromEuler(this.collectibleRotation, 0, Math.PI / 4);

                // Construct matrix manually to include scale
                const mat = quaternionToMat4({ x: c.pos.x, y: newY, z: c.pos.z }, q);
                const scale = 0.5;
                mat[0] *= scale; mat[1] *= scale; mat[2] *= scale;
                mat[4] *= scale; mat[5] *= scale; mat[6] *= scale;
                mat[8] *= scale; mat[9] *= scale; mat[10] *= scale;

                const inst = tcm.getInstance(c.entity);
                tcm.setTransform(inst, mat);

                // Check collision with player
                if (this.playerMarble) {
                    const pt = this.playerMarble.rigidBody.translation();
                    const dx = pt.x - c.pos.x;
                    const dy = pt.y - newY;
                    const dz = pt.z - c.pos.z;
                    const distSq = dx*dx + dy*dy + dz*dz;

                    if (distSq < 2.25) { // 1.5 distance squared
                        // Collected!
                        audio.playCollect();
                        this.score += 10;
                        this.scoreEl.textContent = 'Score: ' + this.score;

                        // Remove
                        this.scene.remove(c.entity);
                        this.engine.destroyEntity(c.entity);
                        this.collectibles.splice(i, 1);
                    }
                }
            }
        }

        // Step Physics with event handling
        this.world.step();

        // Process collision events for audio
        this.processCollisionEvents();

        this.checkGameLogic();

        // Sync Visuals
        const tcm = this.engine.getTransformManager();
        for (const m of this.marbles) {
            const t = m.rigidBody.translation();
            const r = m.rigidBody.rotation();
            const mat = quaternionToMat4(t, r);

            if (m.scale && m.scale !== 1.0) {
                mat[0] *= m.scale; mat[1] *= m.scale; mat[2] *= m.scale;
                mat[4] *= m.scale; mat[5] *= m.scale; mat[6] *= m.scale;
                mat[8] *= m.scale; mat[9] *= m.scale; mat[10] *= m.scale;
            }

            const inst = tcm.getInstance(m.entity);
            tcm.setTransform(inst, mat);
        }

        // Update PowerUps (from main)
        for (const p of this.powerUps) {
            p.rotation += 0.05;
            const q = quatFromEuler(p.rotation, 0, 0);
            const mat = quaternionToMat4(p.pos, q);
            const s = 0.6;
            mat[0] *= s; mat[1] *= s; mat[2] *= s;
            mat[4] *= s; mat[5] *= s; mat[6] *= s;
            mat[8] *= s; mat[9] *= s; mat[10] *= s;

            const inst = tcm.getInstance(p.entity);
            tcm.setTransform(inst, mat);
        }

        // Update active effects UI (from main)
        let effectsText = '';
        if (this.activeEffects.speed && this.activeEffects.speed > now) {
            effectsText += '<div style="color: #ffcc00">SPEED BOOST!</div>';
        }
        if (this.activeEffects.jump && this.activeEffects.jump > now) {
            effectsText += '<div style="color: #00ff00">JUMP BOOST!</div>';
        }
        if (this.effectEl) this.effectEl.innerHTML = effectsText;

        // Update Moving Platforms (Physics) (from main)
        for (const platform of this.movingPlatforms) {
            platform.time += 0.016;
            const t = (Math.sin(platform.time * platform.speed) + 1) / 2;
            const x = platform.start.x + (platform.end.x - platform.start.x) * t;
            const y = platform.start.y + (platform.end.y - platform.start.y) * t;
            const z = platform.start.z + (platform.end.z - platform.start.z) * t;
            platform.rigidBody.setNextKinematicTranslation({ x, y, z });
        }
    }
}