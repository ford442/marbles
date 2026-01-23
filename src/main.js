import RAPIER from '@dimforge/rapier3d-compat';

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

// --- HELPER: Raw Cube Data (Vertices + Colors + Indices) ---
// A simple 1x1x1 cube centered at 0,0,0
const CUBE_VERTICES = new Float32Array([
    // positions (x, y, z)          // colors (r, g, b, a) - encoded as Uint32 later? No, we'll use dedicated logic
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5, // Front
    -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5, -0.5, // Back
    -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5, // Top
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5, // Bottom
     0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5, // Right
    -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5  // Left
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
    this.createFloor();
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
        .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 12) // 3 floats * 4 bytes = 12 bytes stride
        .build(this.engine);
    this.vb.setBufferAt(this.engine, 0, CUBE_VERTICES);

    // Define Index Buffer
    this.ib = this.Filament.IndexBuffer.Builder()
        .indexCount(36)
        .bufferType(this.Filament.IndexBuffer$IndexType.USHORT)
        .build(this.engine);
    this.ib.setBuffer(this.engine, CUBE_INDICES);
  }

  createFloor() {
    // PHYSICS
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0.0, -1.0, 0.0);
    const floorBody = this.world.createRigidBody(floorBodyDesc);
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.5, 50.0); // 100x1x100
    this.world.createCollider(floorColliderDesc, floorBody);

    // VISUALS
    const entity = this.Filament.EntityManager.get().create();
    
    // Create a material instance with a specific color (Grey)
    const matInstance = this.material.createInstance();
    matInstance.setColor3Parameter('color', this.Filament.RgbType.sRGB, [0.5, 0.5, 0.5]);

    // Attach the Renderable
    this.Filament.RenderableManager.Builder(1)
        .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
        .material(0, matInstance)
        .geometry(0, this.Filament.PrimitiveType.TRIANGLES, this.vb, this.ib)
        .build(this.engine, entity);

    // Scale the generic 1x1 cube to look like the floor (100x1x100)
    const tcm = this.engine.getTransformManager();
    const inst = tcm.getInstance(entity);
    const scaleMatrix = new Float32Array([
        100, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 100, 0,
        0, -1, 0, 1 // Position y = -1
    ]);
    tcm.setTransform(inst, scaleMatrix);
    
    this.scene.addEntity(entity);
  }

  createMarbles() {
    const pos = { x: 0, y: 5, z: 0 };
    
    // PHYSICS
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z);
    const rigidBody = this.world.createRigidBody(bodyDesc);
    // Note: Using cuboid collider because our visual is a cube for now!
    // If you want a sphere collider, the cube will roll funny. 
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5); 
    this.world.createCollider(colliderDesc, rigidBody);

    // VISUALS
    const entity = this.Filament.EntityManager.get().create();
    const matInstance = this.material.createInstance();
    matInstance.setColor3Parameter('color', this.Filament.RgbType.sRGB, [1.0, 0.0, 0.0]); // Red Marble

    this.Filament.RenderableManager.Builder(1)
        .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
        .material(0, matInstance)
        .geometry(0, this.Filament.PrimitiveType.TRIANGLES, this.vb, this.ib)
        .build(this.engine, entity);
    
    this.scene.addEntity(entity);
    
    // Store both for the sync loop
    this.marbles.push({ rigidBody, entity });
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
        this.renderer.render(this.view);
        this.renderer.endFrame();
    }
    requestAnimationFrame(() => this.loop());
  }
}

new MarblesGame().init();
