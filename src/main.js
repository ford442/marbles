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
  }

  async init() {
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
        { color: [1.0, 0.0, 0.0], pos: { x: -1.0, y: 8, z: -12 } },
        { color: [0.0, 0.0, 1.0], pos: { x:  1.0, y: 8, z: -12 } }
    ];

    for (const info of marblesInfo) {
        // PHYSICS
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(info.pos.x, info.pos.y, info.pos.z)
            .setCanSleep(false);
        const rigidBody = this.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.ball(0.5);
        this.world.createCollider(colliderDesc, rigidBody);

        // VISUALS
        const entity = this.Filament.EntityManager.get().create();
        const matInstance = this.material.createInstance();
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, info.color);
        matInstance.setFloatParameter('roughness', 0.4);

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .build(this.engine, entity);

        this.scene.addEntity(entity);

        this.marbles.push({ rigidBody, entity });
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
    // 1. Step Physics
    this.world.step();

    // 2. Sync Visuals
    const tcm = this.engine.getTransformManager();
    for (const m of this.marbles) {
        const t = m.rigidBody.translation();
        const r = m.rigidBody.rotation();
        const mat = quaternionToMat4(t, r);
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

new MarblesGame().init();
