import * as Filament from 'filament';
import RAPIER from '@dimforge/rapier3d-compat';

// Helper function to convert Quaternion and position to 4x4 matrix (column-major)
function quaternionToMat4(position, quaternion) {
  const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  // Column-major 4x4 matrix
  return new Float32Array([
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    position.x, position.y, position.z, 1
  ]);
}

class MarblesGame {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.marbles = [];
    this.entities = [];
  }

  async init() {
    console.log('Initializing Filament and Rapier...');
    
    // Initialize Rapier physics
    await RAPIER.init();
    console.log('Rapier initialized');
    
    // Create physics world with gravity
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    console.log('Physics world created with gravity:', gravity);

    // Initialize Filament
    await Filament.init([
      'https://unpkg.com/filament@1.51.5/filament.wasm'
    ], () => {});
    console.log('Filament initialized');

    // Create Filament Engine
    this.engine = Filament.Engine.create(this.canvas);
    
    // Create Renderer
    this.renderer = this.engine.createRenderer();
    
    // Create Scene
    this.scene = this.engine.createScene();
    
    // Create Camera
    const eye = [0, 10, 20];
    const center = [0, 0, 0];
    const up = [0, 1, 0];
    this.camera = this.engine.createCamera(Filament.EntityManager.get().create());
    this.camera.lookAt(eye, center, up);
    
    // Create View
    this.view = this.engine.createView();
    this.view.setCamera(this.camera);
    this.view.setScene(this.scene);
    this.view.setViewport([0, 0, this.canvas.width, this.canvas.height]);

    // Setup swap chain
    this.swapChain = this.engine.createSwapChain();
    
    // Resize handler
    this.resize();
    window.addEventListener('resize', () => this.resize());

    console.log('Filament components created');

    // Create floor and marbles
    this.createFloor();
    this.createMarbles();

    console.log('Scene setup complete');
  }

  resize() {
    const dpr = window.devicePixelRatio;
    const width = this.canvas.width = window.innerWidth * dpr;
    const height = this.canvas.height = window.innerHeight * dpr;
    this.view.setViewport([0, 0, width, height]);
    
    const aspect = width / height;
    const fov = aspect < 1 ? Filament.Camera$Fov.HORIZONTAL : Filament.Camera$Fov.VERTICAL;
    this.camera.setProjectionFov(45, aspect, 1.0, 1000.0, fov);
  }

  createFloor() {
    console.log('Creating floor...');
    
    // Physics: Create static floor rigid body
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0.0, 0.0, 0.0);
    const floorBody = this.world.createRigidBody(floorBodyDesc);
    
    // Create a large box collider for the floor
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.5, 50.0);
    this.world.createCollider(floorColliderDesc, floorBody);
    
    console.log('Floor created (physics only)');
  }

  createMarbles() {
    console.log('Creating marbles...');
    
    // Create 5 marbles at different positions
    const marblePositions = [
      { x: 0, y: 5, z: 0 },
      { x: 2, y: 8, z: 1 },
      { x: -2, y: 6, z: -1 },
      { x: 1, y: 10, z: 2 },
      { x: -1, y: 7, z: -2 }
    ];

    for (const pos of marblePositions) {
      // Physics: Create dynamic rigid body
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z);
      const rigidBody = this.world.createRigidBody(bodyDesc);
      
      // Add sphere collider (radius 0.5)
      const colliderDesc = RAPIER.ColliderDesc.ball(0.5)
        .setRestitution(0.7) // Bounciness
        .setFriction(0.5);
      this.world.createCollider(colliderDesc, rigidBody);
      
      // Filament: Create entity (visual representation would go here)
      const entity = Filament.EntityManager.get().create();
      this.scene.addEntity(entity);
      
      this.marbles.push({ rigidBody, entity });
    }
    
    console.log(`Created ${this.marbles.length} marbles`);
  }

  update() {
    // Step the physics simulation
    this.world.step();
    
    // Update Filament entities with physics transforms
    for (const marble of this.marbles) {
      const translation = marble.rigidBody.translation();
      const rotation = marble.rigidBody.rotation();
      
      // Convert quaternion and position to 4x4 matrix
      const transform = quaternionToMat4(translation, rotation);
      
      // Get transform manager and update entity transform
      const tm = this.engine.getTransformManager();
      const inst = tm.getInstance(marble.entity);
      tm.setTransform(inst, transform);
    }
  }

  render() {
    // Begin frame
    if (this.renderer.beginFrame(this.swapChain)) {
      this.renderer.render(this.view);
      this.renderer.endFrame();
    }
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  start() {
    console.log('Starting game loop...');
    this.loop();
  }
}

// Initialize and start the game
async function main() {
  try {
    console.log('Starting Marbles 3D Game...');
    const game = new MarblesGame();
    await game.init();
    game.start();
    console.log('Game started successfully!');
  } catch (error) {
    console.error('Error starting game:', error);
  }
}

main();
