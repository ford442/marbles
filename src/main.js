import RAPIER from '@dimforge/rapier3d-compat';
import { createSphere } from './sphere.js';

// --- LEVEL DEFINITIONS ---
const LEVELS = {
    tutorial: {
        name: 'Tutorial Ramp',
        description: 'Learn the basics on a simple ramp',
        zones: [
            { type: 'floor', pos: {x: 0, y: -2, z: 0}, size: {x: 50, y: 0.5, z: 50} },
            { type: 'track', pos: {x: 0, y: 3, z: 0} },
            { type: 'goal', pos: {x: 0, y: 0.25, z: 32.5} }
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
            { type: 'floor', pos: {x: 0, y: -2, z: 0}, size: {x: 50, y: 0.5, z: 50} },
            { type: 'track', pos: {x: 0, y: 3, z: 0} },
            { type: 'landing', pos: {x: 0, y: 0, z: 25} },
            { type: 'goal', pos: {x: 0, y: 0.25, z: 32.5} }
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
            { type: 'floor', pos: {x: 0, y: -2, z: 0}, size: {x: 60, y: 0.5, z: 80} },
            { type: 'track', pos: {x: 0, y: 3, z: 0} },
            { type: 'landing', pos: {x: 0, y: 0, z: 25} },
            { type: 'jump', pos: {x: 0, y: 0, z: 37.5} },
            { type: 'goal', pos: {x: 0, y: -1.4, z: 63} }
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
            { type: 'floor', pos: {x: 0, y: -2, z: 0}, size: {x: 60, y: 0.5, z: 120} },
            { type: 'track', pos: {x: 0, y: 3, z: 0} },
            { type: 'landing', pos: {x: 0, y: 0, z: 25} },
            { type: 'slalom', pos: {x: 0, y: -2, z: 85} },
            { type: 'goal', pos: {x: 0, y: -1.4, z: 100} }
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
            { type: 'floor', pos: {x: 0, y: -2, z: 0}, size: {x: 80, y: 0.5, z: 180} },
            { type: 'track', pos: {x: 0, y: 3, z: 0} },
            { type: 'landing', pos: {x: 0, y: 0, z: 25} },
            { type: 'slalom', pos: {x: 0, y: -2, z: 85} },
            { type: 'staircase', pos: {x: 0, y: -2, z: 110} },
            { type: 'goal', pos: {x: 0, y: 9, z: 154} }
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
            { type: 'floor', pos: {x: 0, y: -2, z: 50}, size: {x: 100, y: 0.5, z: 200} },
            { type: 'track', pos: {x: 0, y: 3, z: 0} },
            { type: 'landing', pos: {x: 0, y: 0, z: 25} },
            { type: 'goal', pos: {x: 0, y: 0.25, z: 32.5}, color: [1, 0.84, 0] },
            { type: 'jump', pos: {x: 0, y: 0, z: 37.5} },
            { type: 'slalom', pos: {x: 0, y: -2, z: 85} },
            { type: 'goal', pos: {x: 0, y: -1.4, z: 100}, color: [1, 0.84, 0] },
            { type: 'staircase', pos: {x: 0, y: -2, z: 110} },
            { type: 'goal', pos: {x: 0, y: 9, z: 154}, color: [1, 0.5, 0] }
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
            { type: 'floor', pos: {x: 0, y: -2, z: 0}, size: {x: 100, y: 0.5, z: 100} }
        ],
        spawn: { x: 0, y: 5, z: 0 },
        goals: [],
        camera: { mode: 'orbit', angle: 0, height: 15, radius: 40 }
    },
    extreme: {
        name: 'Extreme Challenge',
        description: 'Split paths and a forest of pillars',
        zones: [
            { type: 'floor', pos: {x: 0, y: -2, z: 0}, size: {x: 80, y: 0.5, z: 200} },
            { type: 'track', pos: {x: 0, y: 3, z: 0} },
            { type: 'landing', pos: {x: 0, y: 0, z: 25} },
            { type: 'split', pos: {x: 0, y: 0, z: 40} },
            { type: 'forest', pos: {x: 0, y: -4, z: 120} },
            { type: 'goal', pos: {x: 0, y: -3.5, z: 160} }
        ],
        spawn: { x: 0, y: 8, z: -12 },
        goals: [
            { id: 1, range: { x: [-3, 3], z: [158, 162], y: [-5, 5] } }
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
    const module = await import('filament');
    return module.default;
}

class MarblesGame {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.marbles = [];
        this.staticBodies = []; // Track for cleanup
        this.staticEntities = []; // Track for cleanup
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
        this.currentMarbleIndex = 0;
        this.aimYaw = 0;
        this.pitchAngle = 0;  // FIX: Initialize pitchAngle
        this.chargePower = 0;
        this.charging = false;
        this.isAiming = false;
        this.playerMarble = null;
        this.cueInst = null;  // FIX: Initialize cueInst

        // Level State
        this.currentLevel = null;
        this.levelStartTime = 0;
        this.levelComplete = false;
        this.goalDefinitions = [];
    }

    async init() {
        // Input Listeners
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyC') {
                this.cameraMode = this.cameraMode === 'orbit' ? 'follow' : 'orbit';
                console.log('Camera Mode:', this.cameraMode);
            }
        });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

        window.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // Right Click
                this.isAiming = true;
            } else if (e.button === 0) { // Left Click
                this.charging = true;
                this.chargePower = 0;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.isAiming = false;
            } else if (e.button === 0) {
                if (this.charging) {
                    this.shootMarble();
                    this.charging = false;
                }
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (this.isAiming) {
                this.aimYaw -= e.movementX * 0.005;
                this.pitchAngle -= e.movementY * 0.005;
                this.pitchAngle = Math.max(-0.5, Math.min(1.5, this.pitchAngle));
            }
        });

        // 1. Initialize Physics
        await RAPIER.init();
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.world = new RAPIER.World(gravity);

        // 2. Initialize Filament
        const Factory = await loadFilament();
        let capturedModule = null;
        const originalLoadClassExtensions = Factory.loadClassExtensions;
        Factory.loadClassExtensions = function () {
            capturedModule = this;
            if (originalLoadClassExtensions) originalLoadClassExtensions();
        };
        await new Promise((resolve) => Factory.init([], resolve));
        this.Filament = capturedModule;

        this.engine = this.Filament.Engine.create(this.canvas);
        this.scene = this.engine.createScene();
        this.swapChain = this.engine.createSwapChain();
        this.renderer = this.engine.createRenderer();

        // Camera setup
        this.camera = this.engine.createCamera(this.Filament.EntityManager.get().create());
        this.view = this.engine.createView();
        this.view.setCamera(this.camera);
        this.view.setScene(this.scene);
        this.renderer.setClearOptions({ clearColor: [0.1, 0.1, 0.1, 1.0], clear: true });

        // 3. LOAD ASSETS
        await this.setupAssets();

        // 4. Create Light
        this.createLight();

        // 5. Show Level Selection
        this.showLevelSelection();

        // 6. Resize & Start
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.loop();
    }

    showLevelSelection() {
        const menu = document.getElementById('level-menu');
        const levelGrid = document.getElementById('level-grid');
        const gameUI = document.getElementById('ui');
        
        menu.style.display = 'flex';
        gameUI.style.display = 'none';
        levelGrid.innerHTML = '';

        Object.entries(LEVELS).forEach(([id, level]) => {
            const card = document.createElement('div');
            card.className = 'level-card';
            card.innerHTML = `
                <h3>${level.name}</h3>
                <p>${level.description}</p>
                <span class="goals">${level.goals.length} Goal${level.goals.length !== 1 ? 's' : ''}</span>
            `;
            card.addEventListener('click', () => this.loadLevel(id));
            levelGrid.appendChild(card);
        });
    }

    async loadLevel(levelId) {
        const level = LEVELS[levelId];
        if (!level) return;

        // Hide menu, show game UI
        document.getElementById('level-menu').style.display = 'none';
        document.getElementById('ui').style.display = 'block';

        // Clear existing level
        this.clearLevel();

        // Set level state
        this.currentLevel = levelId;
        this.levelNameEl.textContent = level.name;
        this.goalDefinitions = level.goals;
        this.score = 0;
        this.scoreEl.textContent = 'Score: 0';
        this.levelStartTime = Date.now();
        this.levelComplete = false;

        // Set camera defaults from level
        if (level.camera) {
            this.cameraMode = level.camera.mode || 'orbit';
            this.camAngle = level.camera.angle || 0;
            this.camHeight = level.camera.height || 10;
            this.camRadius = level.camera.radius || 25;
        }

        // Build zones
        for (const zone of level.zones) {
            await this.createZone(zone);
        }

        // Spawn marbles at level spawn point
        this.createMarbles(level.spawn);
    }

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
    }

    async createZone(zone) {
        const pos = zone.pos || {x: 0, y: 0, z: 0};
        const offset = {x: pos.x, y: pos.y, z: pos.z};

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
        }
    }

    createFloorZone(offset, size) {
        const sz = size || {x: 50, y: 0.5, z: 50};
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            {x: 0, y: 0, z: 0, w: 1},
            {x: sz.x / 2, y: sz.y / 2, z: sz.z / 2},
            [0.3, 0.3, 0.3]
        );
    }

    createTrackZone(offset) {
        const angle = 0.2;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const q = {x: sinA, y: 0, z: 0, w: cosA};

        // Main ramp
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            q,
            {x: 4, y: 0.2, z: 15},
            [0.6, 0.6, 0.6]
        );

        // Side walls
        this.createStaticBox(
            {x: offset.x - 3.5, y: offset.y + 1, z: offset.z},
            q,
            {x: 0.5, y: 1.5, z: 15},
            [0.5, 0.3, 0.3]
        );
        this.createStaticBox(
            {x: offset.x + 3.5, y: offset.y + 1, z: offset.z},
            q,
            {x: 0.5, y: 1.5, z: 15},
            [0.5, 0.3, 0.3]
        );
    }

    createLandingZone(offset) {
        const floorQ = {x: 0, y: 0, z: 0, w: 1};

        // Floor
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            floorQ,
            {x: 5, y: 0.25, z: 10},
            [0.4, 0.4, 0.4]
        );

        // Pillars
        this.createStaticBox(
            {x: offset.x - 3, y: offset.y + 1.5, z: offset.z - 5},
            floorQ,
            {x: 0.5, y: 1.5, z: 0.5},
            [0.8, 0.2, 0.2]
        );
        this.createStaticBox(
            {x: offset.x + 3, y: offset.y + 1.5, z: offset.z},
            floorQ,
            {x: 0.5, y: 1.5, z: 0.5},
            [0.2, 0.2, 0.8]
        );
        this.createStaticBox(
            {x: offset.x, y: offset.y + 0.75, z: offset.z + 5},
            floorQ,
            {x: 2, y: 0.5, z: 0.5},
            [0.2, 0.8, 0.2]
        );
    }

    createJumpZone(offset) {
        const floorQ = {x: 0, y: 0, z: 0, w: 1};

        // Approach
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            floorQ,
            {x: 5, y: 0.25, z: 2.5},
            [0.4, 0.4, 0.4]
        );

        // Ramp
        const angle = -0.4;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = {x: sinA, y: 0, z: 0, w: cosA};
        this.createStaticBox(
            {x: offset.x, y: offset.y + 1.0, z: offset.z + 5},
            rampQ,
            {x: 5, y: 0.25, z: 3},
            [0.7, 0.3, 0.3]
        );

        // Landing
        this.createStaticBox(
            {x: offset.x, y: offset.y - 2, z: offset.z + 22.5},
            floorQ,
            {x: 8, y: 0.5, z: 5},
            [0.3, 0.7, 0.3]
        );

        // Target
        this.createStaticBox(
            {x: offset.x, y: offset.y - 1, z: offset.z + 25.5},
            floorQ,
            {x: 1, y: 0.5, z: 1},
            [0.8, 0.8, 0.2]
        );
    }

    createSlalomZone(offset) {
        const floorQ = {x: 0, y: 0, z: 0, w: 1};

        // Floor
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            floorQ,
            {x: 6, y: 0.5, z: 20},
            [0.3, 0.3, 0.5]
        );

        // Pillars (relative to offset)
        for (let z = -15; z <= 15; z += 5) {
            if (z === 15) continue;
            const pillarX = ((z + 15) / 5) % 2 === 0 ? 3 : -3;
            this.createStaticBox(
                {x: offset.x + pillarX, y: offset.y + 2, z: offset.z + z},
                floorQ,
                {x: 0.5, y: 1.5, z: 0.5},
                [0.9, 0.1, 0.1]
            );
        }
    }

    createStaircaseZone(offset) {
        const floorQ = {x: 0, y: 0, z: 0, w: 1};

        // Initial platform
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            floorQ,
            {x: 4, y: 0.5, z: 4},
            [0.4, 0.4, 0.6]
        );

        // Steps
        let currentY = offset.y;
        let currentZ = offset.z;
        for (let i = 0; i < 10; i++) {
            currentY += 1.0;
            currentZ += 4.0;
            this.createStaticBox(
                {x: offset.x, y: currentY, z: currentZ},
                floorQ,
                {x: 2, y: 0.5, z: 1.5},
                [0.2 + (i * 0.05), 0.5, 0.8 - (i * 0.05)]
            );
        }
    }

    createSplitZone(offset) {
        const floorQ = {x: 0, y: 0, z: 0, w: 1};

        // Start Platform
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            floorQ,
            {x: 4, y: 0.5, z: 4},
            [0.4, 0.4, 0.4]
        );

        // Left Path (Narrow)
        this.createStaticBox(
            {x: offset.x - 2, y: offset.y, z: offset.z + 14},
            floorQ,
            {x: 1, y: 0.5, z: 10},
            [0.6, 0.3, 0.3]
        );

        // Right Path (Jump)
        // Ramp up
        const angle = -0.3;
        const sinA = Math.sin(angle / 2);
        const cosA = Math.cos(angle / 2);
        const rampQ = {x: sinA, y: 0, z: 0, w: cosA};

        this.createStaticBox(
            {x: offset.x + 2, y: offset.y + 1, z: offset.z + 8},
            rampQ,
            {x: 1, y: 0.5, z: 4},
            [0.3, 0.3, 0.6]
        );

        // Landing pad further away
        this.createStaticBox(
            {x: offset.x + 2, y: offset.y, z: offset.z + 20},
            floorQ,
            {x: 1.5, y: 0.5, z: 4},
            [0.3, 0.3, 0.6]
        );

        // Merge Platform
        this.createStaticBox(
            {x: offset.x, y: offset.y - 1, z: offset.z + 30},
            floorQ,
            {x: 4, y: 0.5, z: 4},
            [0.4, 0.4, 0.4]
        );
    }

    createForestZone(offset) {
        const floorQ = {x: 0, y: 0, z: 0, w: 1};

        // Floor
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            floorQ,
            {x: 10, y: 0.5, z: 20},
            [0.2, 0.5, 0.2]
        );

        // Random Pillars
        for (let i = 0; i < 20; i++) {
            const rx = (Math.sin(i * 12.9898) * 9);
            const rz = (Math.cos(i * 78.233) * 19);

            this.createStaticBox(
                {x: offset.x + rx, y: offset.y + 2, z: offset.z + rz},
                floorQ,
                {x: 0.5 + Math.sin(i)*0.2, y: 2 + Math.cos(i), z: 0.5 + Math.sin(i)*0.2},
                [0.55, 0.27, 0.07]
            );
        }
    }

    createGoalZone(offset, color) {
        const q = {x: 0, y: 0, z: 0, w: 1};
        this.createStaticBox(
            {x: offset.x, y: offset.y, z: offset.z},
            q,
            {x: 2, y: 0.25, z: 2},
            color || [1.0, 0.84, 0.0]
        );
    }

    async setupAssets() {
        const response = await fetch('./baked_color.filmat');
        const buffer = await response.arrayBuffer();
        this.material = this.engine.createMaterial(new Uint8Array(buffer));

        const VertexAttribute = this.Filament.VertexAttribute;
        const AttributeType = this.Filament.VertexBuffer$AttributeType;

        this.vb = this.Filament.VertexBuffer.Builder()
            .vertexCount(24)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 28)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 28)
            .build(this.engine);
        this.vb.setBufferAt(this.engine, 0, CUBE_VERTICES);

        this.ib = this.Filament.IndexBuffer.Builder()
            .indexCount(36)
            .bufferType(this.Filament.IndexBuffer$IndexType.USHORT)
            .build(this.engine);
        this.ib.setBuffer(this.engine, CUBE_INDICES);

        const sphereData = createSphere(0.5, 32, 16);
        this.sphereVb = this.Filament.VertexBuffer.Builder()
            .vertexCount(sphereData.vertices.length / 7)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 28)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 28)
            .build(this.engine);
        this.sphereVb.setBufferAt(this.engine, 0, sphereData.vertices);

        this.sphereIb = this.Filament.IndexBuffer.Builder()
            .indexCount(sphereData.indices.length)
            .bufferType(this.Filament.IndexBuffer$IndexType.USHORT)
            .build(this.engine);
        this.sphereIb.setBuffer(this.engine, sphereData.indices);

        this.createCueStick();
    }

    createCueStick() {
        this.cueEntity = this.Filament.EntityManager.get().create();
        const cueColor = [1.0, 1.0, 0.0];
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, cueColor);
        matInstance.setFloatParameter('roughness', 0.2);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5]})
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, this.cueEntity);

        this.scene.addEntity(this.cueEntity);

        const tcm = this.engine.getTransformManager();
        this.cueInst = tcm.getInstance(this.cueEntity);

        const zeroMat = new Float32Array(16);
        zeroMat[15] = 1;
        tcm.setTransform(this.cueInst, zeroMat);
    }

    shootMarble() {
        if (!this.playerMarble) return;

        const force = 50.0 + this.chargePower * 150.0;
        const cosP = Math.cos(this.pitchAngle);
        const sinP = Math.sin(this.pitchAngle);

        const dirX = Math.sin(this.aimYaw) * cosP;
        const dirY = sinP;
        const dirZ = Math.cos(this.aimYaw) * cosP;

        this.playerMarble.rigidBody.applyImpulse({
            x: dirX * force,
            y: dirY * force,
            z: dirZ * force
        }, true);

        this.chargePower = 0;
        this.powerbarEl.style.width = '0%';
    }

    createLight() {
        this.light = this.Filament.EntityManager.get().create();
        this.Filament.LightManager.Builder(this.Filament.LightManager$Type.DIRECTIONAL)
            .color([0.98, 0.92, 0.89])
            .intensity(110000.0)
            .direction([0.6, -1.0, -0.8])
            .castShadows(true)
            .sunAngularRadius(1.9)
            .sunHaloSize(10.0)
            .sunHaloFalloff(80.0)
            .build(this.engine, this.light);
        this.scene.addEntity(this.light);

        this.fillLight = this.Filament.EntityManager.get().create();
        this.Filament.LightManager.Builder(this.Filament.LightManager$Type.DIRECTIONAL)
            .color([0.8, 0.8, 1.0])
            .intensity(30000.0)
            .direction([-0.6, -0.5, 0.8])
            .castShadows(false)
            .build(this.engine, this.fillLight);
        this.scene.addEntity(this.fillLight);

        this.backLight = this.Filament.EntityManager.get().create();
        this.Filament.LightManager.Builder(this.Filament.LightManager$Type.DIRECTIONAL)
            .color([0.5, 0.5, 0.5])
            .intensity(20000.0)
            .direction([0.0, -1.0, 1.0])
            .castShadows(false)
            .build(this.engine, this.backLight);
        this.scene.addEntity(this.backLight);
    }

    createStaticBox(pos, rotation, halfExtents, color) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(rotation);
        const body = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
        this.world.createCollider(colliderDesc, body);
        this.staticBodies.push(body);

        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.4);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5]})
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, entity);

        const tcm = this.engine.getTransformManager();
        const inst = tcm.getInstance(entity);

        const mat = quaternionToMat4(pos, rotation);
        const sx = halfExtents.x * 2;
        const sy = halfExtents.y * 2;
        const sz = halfExtents.z * 2;

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

        tcm.setTransform(inst, mat);
        this.scene.addEntity(entity);
        this.staticEntities.push(entity);
    }

    createMarbles(spawnPos) {
        const baseSpawn = spawnPos || {x: 0, y: 8, z: -12};
        
        const marblesInfo = [
            {color: [1.0, 0.0, 0.0], offset: {x: -1.0, y: 0, z: 0}},
            {color: [0.0, 0.0, 1.0], offset: {x: 1.0, y: 0, z: 0}},
            {color: [0.2, 1.0, 0.2], offset: {x: -2.5, y: 4, z: 0}, radius: 0.4, friction: 0.1, restitution: 0.8, roughness: 0.2},
            {color: [0.6, 0.1, 0.8], offset: {x: 0.0, y: 2, z: 2}, radius: 0.75, restitution: 1.2},
            {color: [1.0, 0.84, 0.0], offset: {x: 2.5, y: 2, z: 2}, radius: 0.6, restitution: 0.2, density: 3.0, roughness: 0.3},
            {color: [0.0, 0.8, 1.0], offset: {x: -2.0, y: 2, z: 2}, radius: 0.5, friction: 0.05, restitution: 0.5, roughness: 0.1},
            {color: [0.1, 0.1, 0.1], offset: {x: 3.5, y: 4, z: 0}, radius: 0.55, density: 10.0, friction: 0.9, restitution: 0.1, roughness: 0.7}
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
                .setRestitution(info.restitution || 0.5);

            if (info.density) colliderDesc.setDensity(info.density);
            if (info.friction !== undefined) colliderDesc.setFriction(info.friction);

            this.world.createCollider(colliderDesc, rigidBody);

            const entity = this.Filament.EntityManager.get().create();
            const matInstance = this.material.createInstance();
            matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, info.color);
            matInstance.setFloatParameter('roughness', info.roughness !== undefined ? info.roughness : 0.4);

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({center: [0, 0, 0], halfExtent: [radius, radius, radius]})
                .material(0, matInstance)
                .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
                .build(this.engine, entity);

            this.scene.addEntity(entity);

            this.marbles.push({
                rigidBody,
                entity,
                scale,
                initialPos: pos,
                scoredGoals: new Set()
            });
        }
        
        this.currentMarbleIndex = 0;
        this.playerMarble = this.marbles[0];
        this.selectedEl.textContent = 'Selected: 1';
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
        for (const m of this.marbles) {
            m.rigidBody.setTranslation(m.initialPos, true);
            m.rigidBody.setLinvel({x: 0, y: 0, z: 0}, true);
            m.rigidBody.setAngvel({x: 0, y: 0, z: 0}, true);
            m.scoredGoals.clear();
        }
        this.score = 0;
        this.scoreEl.textContent = 'Score: 0';
        this.currentMarbleIndex = 0;
        this.playerMarble = this.marbles[0];
        this.selectedEl.textContent = 'Selected: 1';
        this.aimYaw = 0;
        this.chargePower = 0;
        this.charging = false;
        this.powerbarEl.style.width = '0%';
        this.levelComplete = false;
    }

    returnToMenu() {
        this.clearLevel();
        this.showLevelSelection();
    }

    checkGameLogic() {
        if (!this.currentLevel || this.levelComplete) return;

        const level = LEVELS[this.currentLevel];
        let allGoalsScored = level.goals.length > 0;

        for (const m of this.marbles) {
            const t = m.rigidBody.translation();

            // Respawn logic
            if (t.y < -20) {
                m.rigidBody.setTranslation(m.initialPos, true);
                m.rigidBody.setLinvel({x: 0, y: 0, z: 0}, true);
                m.rigidBody.setAngvel({x: 0, y: 0, z: 0}, true);
                m.scoredGoals.clear();
                continue;
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
        const width = this.canvas.width = window.innerWidth;
        const height = this.canvas.height = window.innerHeight;
        this.view.setViewport([0, 0, width, height]);
        const aspect = width / height;
        this.camera.setProjectionFov(45, aspect, 1.0, 1000.0, this.Filament.Camera$Fov.VERTICAL);
        this.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0]);
    }

    loop() {
        const rotSpeed = 0.02;
        const zoomSpeed = 0.5;

        // Handle input
        if (this.keys['KeyR']) {
            this.resetMarbles();
        }
        if (this.keys['KeyM'] && this.currentLevel) {
            this.returnToMenu();
        }

        // Handle Charging
        if (this.charging) {
            this.chargePower = Math.min(1.0, this.chargePower + 0.02);
        }

        if (this.cameraMode === 'orbit') {
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.camAngle -= rotSpeed;
            if (this.keys['ArrowRight'] || this.keys['KeyD']) this.camAngle += rotSpeed;
            if (this.keys['ArrowUp'] || this.keys['KeyW']) this.camRadius = Math.max(5, this.camRadius - zoomSpeed);
            if (this.keys['ArrowDown'] || this.keys['KeyS']) this.camRadius = Math.min(100, this.camRadius + zoomSpeed);
        } else {
            const impulseStrength = 0.5;
            const jumpStrength = 1.0;

            if (this.playerMarble) {
                const rigidBody = this.playerMarble.rigidBody;
                if (this.keys['ArrowUp'] || this.keys['KeyW']) rigidBody.applyImpulse({x: 0, y: 0, z: impulseStrength}, true);
                if (this.keys['ArrowDown'] || this.keys['KeyS']) rigidBody.applyImpulse({x: 0, y: 0, z: -impulseStrength}, true);
                if (this.keys['ArrowLeft'] || this.keys['KeyA']) rigidBody.applyImpulse({x: -impulseStrength, y: 0, z: 0}, true);
                if (this.keys['ArrowRight'] || this.keys['KeyD']) rigidBody.applyImpulse({x: impulseStrength, y: 0, z: 0}, true);
                if (this.keys['Space']) rigidBody.applyImpulse({x: 0, y: jumpStrength, z: 0}, true);
            }
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

        // Step Physics
        this.world.step();
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

        // Update Cue Stick (if charging)
        if (this.cameraMode === 'follow' && this.playerMarble && this.charging && this.cueInst) {
          const cosP = Math.cos(this.pitchAngle);
          const sinP = Math.sin(this.pitchAngle);
          const dirX = Math.sin(this.aimYaw) * cosP;
          const dirY = sinP;
          const dirZ = Math.cos(this.aimYaw) * cosP;
          const length = 0.5 + this.chargePower * 2.5;
          const r = this.playerMarble.scale * 0.5 || 0.5;
          const marbleT = this.playerMarble.rigidBody.translation();
          const cuePos = {
            x: marbleT.x - dirX * (r + 0.2),
            y: marbleT.y - dirY * (r + 0.2),
            z: marbleT.z - dirZ * (r + 0.2)
          };
          const quat = quatFromEuler(this.aimYaw, this.pitchAngle, 0);
          let mat = quaternionToMat4(cuePos, quat);
          const thin = 0.04;
          mat[0] *= thin; mat[1] *= thin; mat[2] *= thin;
          mat[4] *= thin; mat[5] *= thin; mat[6] *= thin;
          mat[8] *= length; mat[9] *= length; mat[10] *= length;
          this.engine.getTransformManager().setTransform(this.cueInst, mat);
        } else if (this.cueInst) {
          const zeroMat = new Float32Array(16);
          zeroMat[15] = 1;
          this.engine.getTransformManager().setTransform(this.cueInst, zeroMat);
        }

        // Render
        if (this.renderer.beginFrame(this.swapChain)) {
            this.renderer.render(this.swapChain, this.view);
            this.renderer.endFrame();
        }
        requestAnimationFrame(() => this.loop());
    }
}

window.game = new MarblesGame();
window.game.init();
