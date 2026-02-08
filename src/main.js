import RAPIER from '@dimforge/rapier3d-compat';
import { createSphere } from './sphere.js';

// --- HELPER: Math for Transforms ---
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
// A simple 1x1x1 cube centered at 0,0,0
// Tangents are quaternions (x, y, z, w) representing the TBN frame
const qTop = [-0.70710678, 0, 0, 0.70710678];
const qBottom = [0.70710678, 0, 0, 0.70710678];
const qRight = [0, -0.70710678, 0, 0.70710678];
const qLeft = [0, 0.70710678, 0, 0.70710678];
const qFront = [0, 0, 0, 1];
const qBack = [0, 1, 0, 0];

const CUBE_VERTICES = new Float32Array([
    // positions (x, y, z)          // tangents (qx, qy, qz, qw)
    // Front
    -0.5, -0.5,  0.5,   ...qFront,
     0.5, -0.5,  0.5,   ...qFront,
     0.5,  0.5,  0.5,   ...qFront,
    -0.5,  0.5,  0.5,   ...qFront,
    // Back
    -0.5, -0.5, -0.5,   ...qBack,
    -0.5,  0.5, -0.5,   ...qBack,
     0.5,  0.5, -0.5,   ...qBack,
     0.5, -0.5, -0.5,   ...qBack,
    // Top
    -0.5,  0.5, -0.5,   ...qTop,
    -0.5,  0.5,  0.5,   ...qTop,
     0.5,  0.5,  0.5,   ...qTop,
     0.5,  0.5, -0.5,   ...qTop,
    // Bottom
    -0.5, -0.5, -0.5,   ...qBottom,
     0.5, -0.5, -0.5,   ...qBottom,
     0.5, -0.5,  0.5,   ...qBottom,
    -0.5, -0.5,  0.5,   ...qBottom,
    // Right
     0.5, -0.5, -0.5,   ...qRight,
     0.5,  0.5, -0.5,   ...qRight,
     0.5,  0.5,  0.5,   ...qRight,
     0.5, -0.5,  0.5,   ...qRight,
    // Left
    -0.5, -0.5, -0.5,   ...qLeft,
    -0.5, -0.5,  0.5,   ...qLeft,
    -0.5,  0.5,  0.5,   ...qLeft,
    -0.5,  0.5, -0.5,   ...qLeft
]);

const CUBE_INDICES = new Uint16Array([
    0, 1, 2, 2, 3, 0,       // Front
    4, 5, 6, 6, 7, 4,       // Back
    8, 9, 10, 10, 11, 8,    // Top
    12, 13, 14, 14, 15, 12, // Bottom
    16, 17, 18, 18, 19, 16, // Right
    20, 21, 22, 22, 23, 20  // Left
]);

async function loadFilament() {
  const module = await import('filament');
  return module.default;
}

class MarblesGame {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.marbles = [];
    this.Filament = null;
    this.material = null; // We need to store the loaded material
    this.cubeMesh = null; // We need to store the geometry

    // Camera State
    this.camAngle = 0;
    this.camHeight = 10;
    this.camRadius = 25;

    // Input State
    this.keys = {};

    // Camera Control Mode
    this.manualCamera = false;
    this.cameraMode = 'orbit'; // 'orbit' or 'follow'

    // Game State
    this.score = 0;
    this.scoreEl = document.getElementById('score');
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

    // 1. Initialize Physics
    await RAPIER.init();
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    // 2. Initialize Filament
    const Factory = await loadFilament();
    let capturedModule = null;
    const originalLoadClassExtensions = Factory.loadClassExtensions;
    Factory.loadClassExtensions = function() {
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
    // Dark grey background to see white cubes clearly
    this.renderer.setClearOptions({clearColor: [0.1, 0.1, 0.1, 1.0], clear: true}); 

    // 3. LOAD ASSETS (The Missing Link!)
    await this.setupAssets();

    // 4. Create Scene Objects
    this.createLight();
    this.createFloor();
    this.createTrack(); // Added track creation
    this.createLandingZone();
    this.createJumpZone();
    this.createSlalomZone();
    this.createGoal();
    this.createMarbles();

    // 5. Resize & Start
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  async setupAssets() {
    // A. Load the Material File
    const response = await fetch('./baked_color.filmat');
    const buffer = await response.arrayBuffer();
    // Create the Material object in Filament
    this.material = this.engine.createMaterial(new Uint8Array(buffer));

    // B. Create the Geometry (The Cube)
    const VertexAttribute = this.Filament.VertexAttribute;
    const AttributeType = this.Filament.VertexBuffer$AttributeType;
    
    // Define Vertex Buffer
    this.vb = this.Filament.VertexBuffer.Builder()
        .vertexCount(24)
        .bufferCount(1)
        .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 28) // 3 floats (pos) + 4 floats (tan) = 7 floats * 4 bytes = 28 bytes stride
        .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 28) // Offset 12 bytes
        .build(this.engine);
    this.vb.setBufferAt(this.engine, 0, CUBE_VERTICES);

    // Define Index Buffer
    this.ib = this.Filament.IndexBuffer.Builder()
        .indexCount(36)
        .bufferType(this.Filament.IndexBuffer$IndexType.USHORT)
        .build(this.engine);
    this.ib.setBuffer(this.engine, CUBE_INDICES);

    // C. Create the Geometry (The Sphere)
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
  }

  createLight() {
    // Main Sun Light
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

    // Fill Light (to simulate ambient/bounce)
    this.fillLight = this.Filament.EntityManager.get().create();
    this.Filament.LightManager.Builder(this.Filament.LightManager$Type.DIRECTIONAL)
        .color([0.8, 0.8, 1.0])
        .intensity(30000.0) // Softer fill
        .direction([-0.6, -0.5, 0.8]) // Opposite direction roughly
        .castShadows(false)
        .build(this.engine, this.fillLight);
    this.scene.addEntity(this.fillLight);

    // Back Light (to light up the dark side)
    this.backLight = this.Filament.EntityManager.get().create();
    this.Filament.LightManager.Builder(this.Filament.LightManager$Type.DIRECTIONAL)
        .color([0.5, 0.5, 0.5])
        .intensity(20000.0)
        .direction([0.0, -1.0, 1.0]) // From behind camera roughly
        .castShadows(false)
        .build(this.engine, this.backLight);
    this.scene.addEntity(this.backLight);
  }

  createStaticBox(pos, rotation, halfExtents, color) {
    // PHYSICS
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation(rotation);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    this.world.createCollider(colliderDesc, body);

    // VISUALS
    const entity = this.Filament.EntityManager.get().create();
    const matInstance = this.material.createInstance();
    matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color);
    matInstance.setFloatParameter('roughness', 0.4);

    this.Filament.RenderableManager.Builder(1)
        .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
        .material(0, matInstance)
        .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
        .build(this.engine, entity);

    const tcm = this.engine.getTransformManager();
    const inst = tcm.getInstance(entity);
    
    // Scale matrix construction: T * R * S
    // quaternionToMat4 returns T * R (if we pass pos)
    const mat = quaternionToMat4(pos, rotation);
    // Scale the columns (S)
    const sx = halfExtents.x * 2;
    const sy = halfExtents.y * 2;
    const sz = halfExtents.z * 2;

    mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
    mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
    mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

    tcm.setTransform(inst, mat);
    this.scene.addEntity(entity);
  }

  createFloor() {
      // Just a base plane
      this.createStaticBox(
          {x: 0, y: -2, z: 0},
          {x: 0, y: 0, z: 0, w: 1},
          {x: 50, y: 0.5, z: 50},
          [0.3, 0.3, 0.3]
      );
  }

  createLandingZone() {
      // Flat platform after the ramp
      // Ramp ends roughly at Z=15, Y=0
      const floorCenter = {x: 0, y: 0, z: 25};
      const floorQ = {x: 0, y: 0, z: 0, w: 1};

      // Floor: 10 wide, 20 long
      this.createStaticBox(
          floorCenter,
          floorQ,
          {x: 5, y: 0.25, z: 10},
          [0.4, 0.4, 0.4]
      );

      // Obstacle 1: Pillar Left
      this.createStaticBox(
          {x: -3, y: 1.5, z: 20},
          floorQ,
          {x: 0.5, y: 1.5, z: 0.5},
          [0.8, 0.2, 0.2]
      );

      // Obstacle 2: Pillar Right
      this.createStaticBox(
          {x: 3, y: 1.5, z: 25},
          floorQ,
          {x: 0.5, y: 1.5, z: 0.5},
          [0.2, 0.2, 0.8]
      );

      // Obstacle 3: Center Low Block
      this.createStaticBox(
          {x: 0, y: 0.75, z: 30},
          floorQ,
          {x: 2, y: 0.5, z: 0.5},
          [0.2, 0.8, 0.2]
      );
  }

  createJumpZone() {
      // 1. Approach Platform (Z=35 to Z=40)
      const floorQ = {x: 0, y: 0, z: 0, w: 1};
      this.createStaticBox(
          {x: 0, y: 0, z: 37.5},
          floorQ,
          {x: 5, y: 0.25, z: 2.5},
          [0.4, 0.4, 0.4]
      );

      // 2. Jump Ramp (Z=40 to Z=45, angled up)
      // Negative angle for UP slope
      const angle = -0.4;
      const sinA = Math.sin(angle/2);
      const cosA = Math.cos(angle/2);
      const rampQ = { x: sinA, y: 0, z: 0, w: cosA };

      // Position needs tweaking to align with Z=40, Y=0
      // A box rotated by -0.4 around center.
      // If center is at Z=42.5, Y=1.0
      this.createStaticBox(
          {x: 0, y: 1.0, z: 42.5},
          rampQ,
          {x: 5, y: 0.25, z: 3}, // Slightly longer to cover
          [0.7, 0.3, 0.3]
      );

      // 3. Landing Platform (Z=55 to Z=65)
      // Lower down
      this.createStaticBox(
          {x: 0, y: -2, z: 60},
          floorQ,
          {x: 8, y: 0.5, z: 5},
          [0.3, 0.7, 0.3]
      );

      // Add a target/obstacle on the landing
      this.createStaticBox(
          {x: 0, y: -1, z: 63},
          floorQ,
          {x: 1, y: 0.5, z: 1},
          [0.8, 0.8, 0.2]
      );
  }

  createSlalomZone() {
      // 1. Base Floor (Z=65 to Z=105)
      // Center: Z=85. Length: 40.
      const floorQ = {x: 0, y: 0, z: 0, w: 1};
      this.createStaticBox(
          {x: 0, y: -2, z: 85},
          floorQ,
          {x: 6, y: 0.5, z: 20}, // Extents: x=6, z=20 (Size 12x40)
          [0.3, 0.3, 0.5]
      );

      // 2. Oscillating Pillars
      // Z: 70 to 100, step 5
      for (let z = 70; z <= 100; z += 5) {
          // Skip the goal area itself if needed, but spacing is 5
          if (z === 100) continue;

          const offset = ((z - 70) / 5) % 2 === 0 ? 3 : -3;
          this.createStaticBox(
              {x: offset, y: 0, z: z},
              floorQ,
              {x: 0.5, y: 1.5, z: 0.5},
              [0.9, 0.1, 0.1]
          );
      }

      // 3. Goal Platform at Z=100
      this.createStaticBox(
          {x: 0, y: -1.4, z: 100}, // Slightly above floor (-1.5)
          floorQ,
          {x: 6, y: 0.1, z: 2}, // Thin strip
          [1.0, 1.0, 0.0]
      );
  }

  createGoal() {
      // Goal Platform at the end (Z=32.5)
      // Visual only here, logic will check bounds
      const center = {x: 0, y: 0.25, z: 32.5}; // Slightly above floor level 0
      const q = {x: 0, y: 0, z: 0, w: 1};

      // Gold Platform (4x4)
      this.createStaticBox(
          center,
          q,
          {x: 2, y: 0.25, z: 2},
          [1.0, 0.84, 0.0]
      );
  }

  createTrack() {
      // Create a ramp: Tilted around X axis
      // Positive angle makes it slope DOWN towards +Z (camera) (Right Hand Rule: +X rot dips +Z down)
      const angle = 0.2; // Radians
      const sinA = Math.sin(angle/2);
      const cosA = Math.cos(angle/2);
      const q = { x: sinA, y: 0, z: 0, w: cosA };

      const center = {x: 0, y: 3, z: 0};

      // Main Ramp Floor
      this.createStaticBox(center, q, {x: 4, y: 0.2, z: 15}, [0.6, 0.6, 0.6]);

      // Side Walls
      // We need to adjust y/z slightly to match the slope visually, but for now fixed Y offset works okay for small angles
      this.createStaticBox(
          {x: -3.5, y: center.y + 1, z: center.z},
          q,
          {x: 0.5, y: 1.5, z: 15},
          [0.5, 0.3, 0.3]
      );

      this.createStaticBox(
          {x: 3.5, y: center.y + 1, z: center.z},
          q,
          {x: 0.5, y: 1.5, z: 15},
          [0.5, 0.3, 0.3]
      );
  }

  createMarbles() {
    const marblesInfo = [
        { color: [1.0, 0.0, 0.0], pos: { x: -1.0, y: 8, z: -12 } }, // Standard Red
        { color: [0.0, 0.0, 1.0], pos: { x:  1.0, y: 8, z: -12 } }, // Standard Blue
        // New Variant: Bouncy Giant Purple Marble
        {
            color: [0.6, 0.1, 0.8],
            pos: { x: 0.0, y: 10, z: -10 },
            radius: 0.75,
            restitution: 1.2
        },
        // Golden Marble: Heavy, Metallic, Shiny
        {
            color: [1.0, 0.84, 0.0],
            pos: { x: 2.5, y: 10, z: -10 },
            radius: 0.6,
            restitution: 0.2,
            density: 3.0,
            roughness: 0.3,
            metallic: 1.0
        },
        // Ice Marble: Slippery, Low Friction
        {
            color: [0.0, 0.8, 1.0], // Cyan
            pos: { x: -2.0, y: 10, z: -10 },
            radius: 0.5,
            friction: 0.05,
            restitution: 0.5,
            roughness: 0.1
        }
    ];

    for (const info of marblesInfo) {
        const radius = info.radius || 0.5;
        const scale = radius / 0.5;

        // PHYSICS
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(info.pos.x, info.pos.y, info.pos.z)
            .setCanSleep(false);
        const rigidBody = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setRestitution(info.restitution || 0.5); // Default restitution roughly 0.5

        if (info.density) {
            colliderDesc.setDensity(info.density);
        }
        if (info.friction !== undefined) {
            colliderDesc.setFriction(info.friction);
        }

        this.world.createCollider(colliderDesc, rigidBody);

        // VISUALS
        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, info.color);
        matInstance.setFloatParameter('roughness', info.roughness !== undefined ? info.roughness : 0.4);
        // if (info.metallic !== undefined) {
        //     matInstance.setFloatParameter('metallic', info.metallic);
        // }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        this.marbles.push({ rigidBody, entity, scale, initialPos: info.pos });
    }
    this.playerMarble = this.marbles[0];
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
        m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        m.scoredGoal1 = false;
        m.scoredGoal2 = false;
    }
    this.score = 0;
    this.scoreEl.innerText = 'Score: 0';
  }

  checkGameLogic() {
    for (const m of this.marbles) {
        const t = m.rigidBody.translation();

        // Respawn Logic (Fell off the world)
        if (t.y < -20) {
            m.rigidBody.setTranslation(m.initialPos, true);
            m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
            m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
            m.scoredGoal1 = false;
            m.scoredGoal2 = false;
            continue;
        }

        // Scoring Logic
        // Goal 1 Area: X[-2, 2], Z[30.5, 34.5] (matches the visual box at Z=32.5, size 4x4)
        if (!m.scoredGoal1 &&
            t.x > -2 && t.x < 2 &&
            t.z > 30.5 && t.z < 34.5 &&
            t.y > 0 && t.y < 2) {

            this.score++;
            this.scoreEl.innerText = 'Score: ' + this.score;
            m.scoredGoal1 = true;
        }

        // Goal 2 Area (Slalom End): X[-2, 2], Z[98, 102]
        // Goal platform Y is -1.4. So detection area Y > -2 && Y < 0.
        if (!m.scoredGoal2 &&
            t.x > -2 && t.x < 2 &&
            t.z > 98 && t.z < 102 &&
            t.y > -2 && t.y < 0) {

            this.score++;
            this.scoreEl.innerText = 'Score: ' + this.score;
            m.scoredGoal2 = true;
        }
    }
  }

  resize() {
    const width = this.canvas.width = window.innerWidth;
    const height = this.canvas.height = window.innerHeight;
    this.view.setViewport([0, 0, width, height]);
    const aspect = width / height;
    this.camera.setProjectionFov(45, aspect, 1.0, 100.0, this.Filament.Camera$Fov.VERTICAL);
    // Look at the scene center
    this.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0]);
  }

  loop() {
    // 0. Handle Input
    const rotSpeed = 0.02;
    const zoomSpeed = 0.5;

    if (this.keys['KeyR']) {
        this.resetMarbles();
    }

    if (this.cameraMode === 'orbit') {
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.camAngle -= rotSpeed;
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.camAngle += rotSpeed;
        }
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            this.camRadius = Math.max(5, this.camRadius - zoomSpeed);
        }
        if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            this.camRadius = Math.min(50, this.camRadius + zoomSpeed);
        }
    } else {
        // Follow Mode: Control Player Marble
        const impulseStrength = 0.5;
        const jumpStrength = 1.0;

        if (this.playerMarble) {
            const rigidBody = this.playerMarble.rigidBody;

            // Movement (+Z is forward down the track)
            if (this.keys['ArrowUp'] || this.keys['KeyW']) {
                rigidBody.applyImpulse({ x: 0, y: 0, z: impulseStrength }, true);
            }
            if (this.keys['ArrowDown'] || this.keys['KeyS']) {
                rigidBody.applyImpulse({ x: 0, y: 0, z: -impulseStrength }, true);
            }
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
                rigidBody.applyImpulse({ x: -impulseStrength, y: 0, z: 0 }, true);
            }
            if (this.keys['ArrowRight'] || this.keys['KeyD']) {
                rigidBody.applyImpulse({ x: impulseStrength, y: 0, z: 0 }, true);
            }
            if (this.keys['Space']) {
                rigidBody.applyImpulse({ x: 0, y: jumpStrength, z: 0 }, true);
            }
        }
    }

    // Update Camera
    if (!this.manualCamera) {
        if (this.cameraMode === 'follow') {
            const target = this.playerMarble || this.getLeader();
            if (target) {
                const t = target.rigidBody.translation();
                // Position camera behind and above. Since track goes +Z, behind is -Z.
                // We want to look towards +Z (motion).
                // Initial marble pos: Z=-12. Moving to Z=100.
                // Camera at Z-20 = -32. Looking at -12. Vector = +20 Z. Correct.
                this.camera.lookAt([t.x, t.y + 10, t.z - 20], [t.x, t.y, t.z], [0, 1, 0]);
            }
        } else {
            // Orbit Mode
            const eyeX = this.camRadius * Math.sin(this.camAngle);
            const eyeZ = this.camRadius * Math.cos(this.camAngle);
            this.camera.lookAt([eyeX, this.camHeight, eyeZ], [0, 0, 0], [0, 1, 0]);
        }
    }

    // 1. Step Physics
    this.world.step();
    this.checkGameLogic();

    // 2. Sync Visuals
    const tcm = this.engine.getTransformManager();
    for (const m of this.marbles) {
        const t = m.rigidBody.translation();
        const r = m.rigidBody.rotation();
        const mat = quaternionToMat4(t, r);

        // Apply Scale
        if (m.scale && m.scale !== 1.0) {
            mat[0] *= m.scale; mat[1] *= m.scale; mat[2] *= m.scale;
            mat[4] *= m.scale; mat[5] *= m.scale; mat[6] *= m.scale;
            mat[8] *= m.scale; mat[9] *= m.scale; mat[10] *= m.scale;
        }

        const inst = tcm.getInstance(m.entity);
        tcm.setTransform(inst, mat);
    }

    // 3. Render
    if (this.renderer.beginFrame(this.swapChain)) {
        this.renderer.render(this.swapChain, this.view);
        this.renderer.endFrame();
    }
    requestAnimationFrame(() => this.loop());
  }
}

window.game = new MarblesGame();
window.game.init();