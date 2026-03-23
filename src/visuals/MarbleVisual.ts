/**
 * MarbleVisual.ts - Complete Visual Overhaul Module
 * Multi-Agent Swarm Evolution: Agents 1-4 Integration
 * Target: WebGL2 + Filament 1.x, 60fps on mid-tier devices
 */

import * as Filament from 'filament';
import { vec3, vec4, quat, mat4 } from 'gl-matrix';

export enum MarbleTheme {
  CLASSIC_GLASS = 'classic_glass',
  OBSIDIAN_METAL = 'obsidian_metal',
  NEON_GLOW = 'neon_glow',
  STONE_VEIN = 'stone_vein'
}

export interface MarbleVisualConfig {
  theme: MarbleTheme;
  position: vec3;
  rotation: quat;
  scale?: number;
}

export interface PhysicsState {
  velocity: vec3;
  angularVelocity: vec3;
  contactPoints: ContactPoint[];
}

export interface ContactPoint {
  point: vec3;
  normal: vec3;
  impulse: number;
}

export enum LODLevel {
  HIGH = 0,    // 0-10m: Full shaders, particles
  MEDIUM = 1,  // 10-30m: Reduced particles
  LOW = 2,     // 30-60m: Simplified shaders
  IMPOSTOR = 3 // 60m+: Billboard sprite
}

// ============================================================================
// AGENT 1: Base Material Properties (Beauty Layer)
// ============================================================================

interface BaseMaterialProps {
  color: vec4;
  roughness: number;
  metallic: number;
  emissive: vec4;
  emissiveIntensity: number;
  clearCoat: number;
  clearCoatRoughness: number;
  rimLightColor: vec4;
  rimLightIntensity: number;
  subsurfaceScattering: number;
  reflectance: number;
  ambientOcclusion: number;
}

const BASE_MATERIALS: Record<MarbleTheme, BaseMaterialProps> = {
  [MarbleTheme.CLASSIC_GLASS]: {
    color: vec4.fromValues(0.85, 0.9, 1.0, 0.3),
    roughness: 0.05,
    metallic: 0.0,
    emissive: vec4.fromValues(0.1, 0.15, 0.25, 1.0),
    emissiveIntensity: 0.15,
    clearCoat: 1.0,
    clearCoatRoughness: 0.05,
    rimLightColor: vec4.fromValues(0.6, 0.8, 1.0, 1.0),
    rimLightIntensity: 0.8,
    subsurfaceScattering: 0.4,
    reflectance: 0.5,
    ambientOcclusion: 0.2
  },
  [MarbleTheme.OBSIDIAN_METAL]: {
    color: vec4.fromValues(0.08, 0.08, 0.1, 1.0),
    roughness: 0.25,
    metallic: 0.95,
    emissive: vec4.fromValues(0.05, 0.05, 0.08, 1.0),
    emissiveIntensity: 0.05,
    clearCoat: 0.3,
    clearCoatRoughness: 0.2,
    rimLightColor: vec4.fromValues(0.9, 0.95, 1.0, 1.0),
    rimLightIntensity: 0.6,
    subsurfaceScattering: 0.1,
    reflectance: 1.0,
    ambientOcclusion: 0.4
  },
  [MarbleTheme.NEON_GLOW]: {
    color: vec4.fromValues(0.95, 0.0, 0.6, 1.0),
    roughness: 0.2,
    metallic: 0.3,
    emissive: vec4.fromValues(1.0, 0.2, 0.8, 1.0),
    emissiveIntensity: 2.5,
    clearCoat: 0.6,
    clearCoatRoughness: 0.1,
    rimLightColor: vec4.fromValues(0.0, 1.0, 0.8, 1.0),
    rimLightIntensity: 1.5,
    subsurfaceScattering: 0.2,
    reflectance: 0.3,
    ambientOcclusion: 0.1
  },
  [MarbleTheme.STONE_VEIN]: {
    color: vec4.fromValues(0.5, 0.42, 0.35, 1.0),
    roughness: 0.85,
    metallic: 0.0,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    rimLightColor: vec4.fromValues(0.7, 0.6, 0.5, 1.0),
    rimLightIntensity: 0.3,
    subsurfaceScattering: 0.6,
    reflectance: 0.1,
    ambientOcclusion: 0.8
  }
};

// ============================================================================
// AGENT 2: Procedural Texture Generation (Complexity Layer)
// ============================================================================

class ProceduralTextureGenerator {
  private static canvas: HTMLCanvasElement | null = null;
  private static ctx: CanvasRenderingContext2D | null = null;
  private static cache: Map<string, Filament.Texture> = new Map();

  static initialize(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
  }

  static generateNoiseTexture(seed: number = 1337): Filament.Texture {
    const cacheKey = `noise_${seed}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    if (!this.ctx || !this.canvas) this.initialize();
    const ctx = this.ctx!;
    const canvas = this.canvas!;

    // Fractal Brownian Motion noise
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;

        // 4 octaves of FBM
        for (let o = 0; o < 4; o++) {
          value += this.simplexNoise(x * frequency / 256, y * frequency / 256, seed) * amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }

        // Normalize to 0-255
        const pixel = Math.floor((value + 1) * 127.5);
        const idx = (y * 512 + x) * 4;
        data[idx] = pixel;
        data[idx + 1] = pixel;
        data[idx + 2] = pixel;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    
    // Convert to Filament texture
    const texture = new Filament.Texture.Builder()
      .width(512)
      .height(512)
      .levels(8)
      .format(Filament.PixelFormat.RGBA8)
      .sampler(Filament.TextureSamplerType.SAMPLER_2D)
      .build();

    // Upload canvas data
    const pixels = new Uint8Array(data.buffer);
    texture.setImage(0, pixels);
    texture.generateMipmaps();

    this.cache.set(cacheKey, texture);
    return texture;
  }

  static generateVeinTexture(theme: MarbleTheme): Filament.Texture {
    const cacheKey = `veins_${theme}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    if (!this.ctx || !this.canvas) this.initialize();
    const ctx = this.ctx!;
    const canvas = this.canvas!;

    ctx.fillStyle = '#5a4030';
    ctx.fillRect(0, 0, 512, 512);

    // Draw marble veins using turbulent noise approximation
    ctx.strokeStyle = '#e8ddd0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      ctx.moveTo(x, y);

      for (let j = 0; j < 100; j++) {
        const angle = this.simplexNoise(x / 100, y / 100, i) * Math.PI * 4;
        x += Math.cos(angle) * 5;
        y += Math.sin(angle) * 5;
        ctx.lineTo(x, y);

        // Wrap around
        if (x < 0) x += 512;
        if (x > 512) x -= 512;
        if (y < 0) y += 512;
        if (y > 512) y -= 512;
      }
      ctx.stroke();
    }

    // Add mineral deposits
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = Math.random() * 10 + 2;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(212, 175, 55, 0.8)'); // Gold
      gradient.addColorStop(1, 'rgba(212, 175, 55, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const imageData = ctx.getImageData(0, 0, 512, 512);
    const texture = new Filament.Texture.Builder()
      .width(512)
      .height(512)
      .levels(8)
      .format(Filament.PixelFormat.RGBA8)
      .sampler(Filament.TextureSamplerType.SAMPLER_2D)
      .build();

    texture.setImage(0, new Uint8Array(imageData.data.buffer));
    texture.generateMipmaps();

    this.cache.set(cacheKey, texture);
    return texture;
  }

  static generateCircuitTexture(): Filament.Texture {
    const cacheKey = 'circuit';
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    if (!this.ctx || !this.canvas) this.initialize();
    const ctx = this.ctx!;
    const canvas = this.canvas!;

    // Black background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 512, 512);

    // Hex grid
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1;
    const hexSize = 32;

    for (let y = 0; y < 512; y += hexSize * 1.5) {
      for (let x = 0; x < 512; x += hexSize * 1.732) {
        const offsetX = (y / (hexSize * 1.5)) % 2 === 0 ? 0 : hexSize * 0.866;
        this.drawHexagon(ctx, x + offsetX, y, hexSize);
      }
    }

    // Circuit traces
    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff00aa';

    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      ctx.moveTo(x, y);

      for (let j = 0; j < 8; j++) {
        const dir = Math.floor(Math.random() * 4);
        const dist = 40 + Math.random() * 60;
        if (dir === 0) x += dist;
        else if (dir === 1) x -= dist;
        else if (dir === 2) y += dist;
        else y -= dist;

        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    const imageData = ctx.getImageData(0, 0, 512, 512);
    const texture = new Filament.Texture.Builder()
      .width(512)
      .height(512)
      .levels(8)
      .format(Filament.PixelFormat.RGBA8)
      .sampler(Filament.TextureSamplerType.SAMPLER_2D)
      .build();

    texture.setImage(0, new Uint8Array(imageData.data.buffer));
    texture.generateMipmaps();

    this.cache.set(cacheKey, texture);
    return texture;
  }

  private static drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  private static simplexNoise(x: number, y: number, seed: number): number {
    // Simple 2D simplex-like noise
    const dot = x * 12.9898 + y * 78.233 + seed;
    const sin = Math.sin(dot) * 43758.5453;
    return sin - Math.floor(sin);
  }
}

// ============================================================================
// AGENT 3: Advanced Rendering (Particle System, Post-Processing)
// ============================================================================

class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles: number = 100;
  private material: Filament.MaterialInstance | null = null;

  constructor(engine: Filament.Engine) {
    // Create particle material
    this.material = Filament.Material.Builder()
      .package(this.createParticleMaterialPackage())
      .build(engine)
      .getDefaultInstance();
  }

  spawnSparkles(position: vec3, count: number, intensity: number): void {
    if (this.particles.length >= this.maxParticles) return;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        position: vec3.clone(position),
        velocity: vec3.fromValues(
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity
        ),
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        size: 0.02 + Math.random() * 0.03,
        color: vec4.fromValues(1, 0.8, 0.3, 1)
      });
    }
  }

  spawnTrail(position: vec3, velocity: vec3, theme: MarbleTheme): void {
    if (this.particles.length >= this.maxParticles) return;

    const color = theme === MarbleTheme.NEON_GLOW
      ? vec4.fromValues(0, 1, 0.8, 0.8)
      : vec4.fromValues(1, 1, 1, 0.5);

    this.particles.push({
      position: vec3.clone(position),
      velocity: vec3.scale(vec3.create(), velocity, -0.1),
      life: 0.5,
      decay: 0.05,
      size: 0.05,
      color
    });
  }

  spawnImpactBurst(position: vec3, force: number, theme: MarbleTheme): void {
    const count = Math.min(20, Math.floor(force * 2));
    const color = this.getImpactColor(theme);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = force * (0.5 + Math.random());
      this.particles.push({
        position: vec3.clone(position),
        velocity: vec3.fromValues(
          Math.cos(angle) * speed,
          Math.abs(Math.sin(angle)) * speed,
          Math.sin(angle) * speed
        ),
        life: 1.0,
        decay: 0.03,
        size: 0.03 + force * 0.01,
        color: vec4.clone(color)
      });
    }
  }

  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay;
      
      vec3.scaleAndAdd(p.position, p.position, p.velocity, deltaTime);
      p.velocity[1] -= 9.8 * deltaTime; // Gravity
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(view: Filament.View, camera: Filament.Camera): void {
    // Batch render particles
    // Implementation depends on Filament's instanced rendering
  }

  private getImpactColor(theme: MarbleTheme): vec4 {
    switch (theme) {
      case MarbleTheme.CLASSIC_GLASS: return vec4.fromValues(0.8, 0.9, 1, 1);
      case MarbleTheme.OBSIDIAN_METAL: return vec4.fromValues(1, 0.5, 0.2, 1);
      case MarbleTheme.NEON_GLOW: return vec4.fromValues(0, 1, 0.8, 1);
      case MarbleTheme.STONE_VEIN: return vec4.fromValues(0.7, 0.6, 0.5, 1);
      default: return vec4.fromValues(1, 1, 1, 1);
    }
  }

  private createParticleMaterialPackage(): Uint8Array {
    // Return compiled Filament material package
    // Placeholder - actual implementation would load precompiled .filamat
    return new Uint8Array(0);
  }
}

interface Particle {
  position: vec3;
  velocity: vec3;
  life: number;
  decay: number;
  size: number;
  color: vec4;
}

// ============================================================================
// AGENT 4: Main MarbleVisual Class (Integration & Validation)
// ============================================================================

export class MarbleVisual {
  private theme: MarbleTheme;
  private material: Filament.MaterialInstance | null = null;
  private renderable: Filament.Renderable | null = null;
  private transform: mat4 = mat4.create();
  private lodLevel: LODLevel = LODLevel.HIGH;
  private particleSystem: ParticleSystem | null = null;
  
  // Animation state
  private pulsePhase: number = 0;
  private lastContactTime: number = 0;
  private boostActive: boolean = false;
  private boostTime: number = 0;
  private speedTrailTimer: number = 0;

  // Performance tracking
  private updateTimeAccumulator: number = 0;
  private updateCount: number = 0;

  constructor(
    private engine: Filament.Engine,
    private scene: Filament.Scene,
    config: MarbleVisualConfig
  ) {
    this.theme = config.theme;
    this.particleSystem = new ParticleSystem(engine);
    this.createMaterial();
    this.createRenderable(config);
    this.updateTransform(config.position, config.rotation, config.scale || 1.0);
  }

  // --------------------------------------------------------------------
  // Material Creation (Agents 1-3 Integration)
  // --------------------------------------------------------------------

  private createMaterial(): void {
    const base = BASE_MATERIALS[this.theme];
    
    // Create material based on theme
    const builder = Filament.Material.Builder();
    
    switch (this.theme) {
      case MarbleTheme.CLASSIC_GLASS:
        this.material = this.createGlassMaterial(builder, base);
        break;
      case MarbleTheme.OBSIDIAN_METAL:
        this.material = this.createMetalMaterial(builder, base);
        break;
      case MarbleTheme.NEON_GLOW:
        this.material = this.createNeonMaterial(builder, base);
        break;
      case MarbleTheme.STONE_VEIN:
        this.material = this.createStoneMaterial(builder, base);
        break;
    }
  }

  private createGlassMaterial(
    builder: Filament.Material.Builder,
    base: BaseMaterialProps
  ): Filament.MaterialInstance {
    // Glass: Transmission + Refraction
    const mat = builder
      .package(this.loadMaterialPackage('glass'))
      .build(this.engine)
      .getDefaultInstance();

    mat.setColorParameter('baseColor', base.color);
    mat.setFloatParameter('roughness', base.roughness);
    mat.setFloatParameter('metallic', base.metallic);
    mat.setFloatParameter('clearCoat', base.clearCoat);
    mat.setFloatParameter('clearCoatRoughness', base.clearCoatRoughness);
    mat.setFloatParameter('transmission', 0.7);
    mat.setFloatParameter('ior', 1.52);
    mat.setColorParameter('emissive', base.emissive);
    mat.setFloatParameter('emissiveIntensity', base.emissiveIntensity);

    // Add noise texture for bubbles
    const noiseTex = ProceduralTextureGenerator.generateNoiseTexture();
    mat.setTextureParameter('noiseTexture', noiseTex, this.getDefaultSampler());

    return mat;
  }

  private createMetalMaterial(
    builder: Filament.Material.Builder,
    base: BaseMaterialProps
  ): Filament.MaterialInstance {
    // Metal: High reflectance + Anisotropic
    const mat = builder
      .package(this.loadMaterialPackage('metal'))
      .build(this.engine)
      .getDefaultInstance();

    mat.setColorParameter('baseColor', base.color);
    mat.setFloatParameter('roughness', base.roughness);
    mat.setFloatParameter('metallic', base.metallic);
    mat.setFloatParameter('clearCoat', base.clearCoat);
    mat.setFloatParameter('reflectance', base.reflectance);
    mat.setColorParameter('emissive', base.emissive);
    mat.setFloatParameter('emissiveIntensity', base.emissiveIntensity);

    // Add noise for hammered texture
    const noiseTex = ProceduralTextureGenerator.generateNoiseTexture();
    mat.setTextureParameter('roughnessMap', noiseTex, this.getDefaultSampler());

    return mat;
  }

  private createNeonMaterial(
    builder: Filament.Material.Builder,
    base: BaseMaterialProps
  ): Filament.MaterialInstance {
    // Neon: High emissive + Circuit texture
    const mat = builder
      .package(this.loadMaterialPackage('neon'))
      .build(this.engine)
      .getDefaultInstance();

    mat.setColorParameter('baseColor', base.color);
    mat.setFloatParameter('roughness', base.roughness);
    mat.setFloatParameter('metallic', base.metallic);
    mat.setFloatParameter('clearCoat', base.clearCoat);
    mat.setColorParameter('emissive', base.emissive);
    mat.setFloatParameter('emissiveIntensity', base.emissiveIntensity);

    // Add circuit texture
    const circuitTex = ProceduralTextureGenerator.generateCircuitTexture();
    mat.setTextureParameter('circuitTexture', circuitTex, this.getDefaultSampler());

    return mat;
  }

  private createStoneMaterial(
    builder: Filament.Material.Builder,
    base: BaseMaterialProps
  ): Filament.MaterialInstance {
    // Stone: Vein texture + Normal map
    const mat = builder
      .package(this.loadMaterialPackage('stone'))
      .build(this.engine)
      .getDefaultInstance();

    mat.setColorParameter('baseColor', base.color);
    mat.setFloatParameter('roughness', base.roughness);
    mat.setFloatParameter('metallic', base.metallic);
    mat.setFloatParameter('ambientOcclusion', base.ambientOcclusion);
    mat.setFloatParameter('subsurfacePower', base.subsurfaceScattering);

    // Add vein texture
    const veinTex = ProceduralTextureGenerator.generateVeinTexture(this.theme);
    mat.setTextureParameter('albedo', veinTex, this.getDefaultSampler());

    return mat;
  }

  private createRenderable(config: MarbleVisualConfig): void {
    // Create sphere mesh with appropriate LOD
    const mesh = this.createSphereMesh(32); // 32 segments for high quality
    
    this.renderable = Filament.EntityManager.get().create();
    Filament.RenderableManager.Builder(1)
      .boundingBox({
        center: [0, 0, 0],
        halfExtent: [0.5, 0.5, 0.5]
      })
      .material(0, this.material!)
      .geometry(0, Filament.RenderableManager.PrimitiveType.TRIANGLES, mesh)
      .castShadows(true)
      .receiveShadows(true)
      .build(this.engine, this.renderable);

    this.scene.addEntity(this.renderable);
  }

  private createSphereMesh(segments: number): Filament.VertexBuffer {
    // Generate sphere geometry
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let lat = 0; lat <= segments; lat++) {
      const theta = (lat * Math.PI) / segments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= segments; lon++) {
        const phi = (lon * 2 * Math.PI) / segments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;

        positions.push(x * 0.5, y * 0.5, z * 0.5);
        normals.push(x, y, z);
        uvs.push(lon / segments, lat / segments);
      }
    }

    for (let lat = 0; lat < segments; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const first = lat * (segments + 1) + lon;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    const vertexBuffer = Filament.VertexBuffer.Builder()
      .vertexCount(positions.length / 3)
      .bufferCount(3)
      .attribute(Filament.VertexAttribute.POSITION, 0, Filament.VertexBuffer.AttributeType.FLOAT3, 0, 0)
      .attribute(Filament.VertexAttribute.NORMAL, 1, Filament.VertexBuffer.AttributeType.FLOAT3, 0, 0)
      .attribute(Filament.VertexAttribute.UV0, 2, Filament.VertexBuffer.AttributeType.FLOAT2, 0, 0)
      .build(this.engine);

    vertexBuffer.setBufferAt(this.engine, 0, new Float32Array(positions));
    vertexBuffer.setBufferAt(this.engine, 1, new Float32Array(normals));
    vertexBuffer.setBufferAt(this.engine, 2, new Float32Array(uvs));

    const indexBuffer = Filament.IndexBuffer.Builder()
      .indexCount(indices.length)
      .bufferType(Filament.IndexBuffer.IndexType.UINT16)
      .build(this.engine);
    indexBuffer.setBuffer(this.engine, new Uint16Array(indices));

    return vertexBuffer;
  }

  private getDefaultSampler(): Filament.TextureSampler {
    return new Filament.TextureSampler(
      Filament.MinFilter.LINEAR_MIPMAP_LINEAR,
      Filament.MagFilter.LINEAR,
      Filament.WrapMode.CLAMP_TO_EDGE
    );
  }

  private loadMaterialPackage(type: string): Uint8Array {
    // In production, load precompiled .filamat files
    // For now, return empty - Filament will use default material
    return new Uint8Array(0);
  }

  // --------------------------------------------------------------------
  // Public API - Game Loop Integration
  // --------------------------------------------------------------------

  /**
   * Main update - call every frame
   */
  update(deltaTime: number, velocity: vec3, angularVelocity: vec3): void {
    const startTime = performance.now();

    // Update pulse animation
    this.pulsePhase += deltaTime * (this.theme === MarbleTheme.NEON_GLOW ? 3 : 1);

    // Update boost
    if (this.boostActive) {
      this.boostTime += deltaTime;
      this.updateBoostEffect();
    }

    // Speed-based trail
    const speed = vec3.length(velocity);
    if (speed > 5 && this.lodLevel <= LODLevel.MEDIUM) {
      this.speedTrailTimer += deltaTime;
      if (this.speedTrailTimer > 0.05) {
        this.particleSystem?.spawnTrail(
          this.getWorldPosition(),
          velocity,
          this.theme
        );
        this.speedTrailTimer = 0;
      }
    }

    // Update particles
    this.particleSystem?.update(deltaTime);

    // Update material uniforms
    if (this.material) {
      this.material.setFloatParameter('time', this.pulsePhase);
      this.material.setFloatParameter('speed', speed);
      
      // Contact wobble decay
      const contactAge = this.pulsePhase - this.lastContactTime;
      const wobble = Math.max(0, Math.sin(contactAge * 15) * Math.exp(-contactAge * 3) * 0.15);
      this.material.setFloatParameter('wobble', wobble);
    }

    // Performance tracking
    const elapsed = performance.now() - startTime;
    this.updateTimeAccumulator += elapsed;
    this.updateCount++;
  }

  /**
   * Call when marble collides with something
   */
  onContact(impactForce: number): void {
    this.lastContactTime = this.pulsePhase;
    
    // Spawn impact particles
    if (this.lodLevel <= LODLevel.MEDIUM && impactForce > 0.5) {
      this.particleSystem?.spawnImpactBurst(
        this.getWorldPosition(),
        impactForce,
        this.theme
      );
    }

    // Trigger material wobble
    if (this.material) {
      this.material.setFloatParameter('impactForce', impactForce);
    }
  }

  /**
   * Call when boost starts
   */
  onBoostStart(): void {
    this.boostActive = true;
    this.boostTime = 0;
    
    // Chromatic aberration for neon
    if (this.theme === MarbleTheme.NEON_GLOW) {
      // Trigger post-process effect
    }
  }

  /**
   * Call when boost ends
   */
  onBoostEnd(): void {
    this.boostActive = false;
  }

  /**
   * Set LOD level based on camera distance
   */
  setLOD(distance: number): void {
    let newLOD: LODLevel;
    if (distance < 10) newLOD = LODLevel.HIGH;
    else if (distance < 30) newLOD = LODLevel.MEDIUM;
    else if (distance < 60) newLOD = LODLevel.LOW;
    else newLOD = LODLevel.IMPOSTOR;

    if (newLOD !== this.lodLevel) {
      this.lodLevel = newLOD;
      this.applyLOD();
    }
  }

  private applyLOD(): void {
    if (!this.material) return;

    switch (this.lodLevel) {
      case LODLevel.HIGH:
        this.material.setFloatParameter('lodBias', 0);
        break;
      case LODLevel.MEDIUM:
        this.material.setFloatParameter('lodBias', 1);
        break;
      case LODLevel.LOW:
        this.material.setFloatParameter('lodBias', 2);
        break;
      case LODLevel.IMPOSTOR:
        // Hide mesh, show billboard
        break;
    }
  }

  /**
   * Update transform from physics
   */
  setTransform(position: vec3, rotation: quat): void {
    this.updateTransform(position, rotation, 1.0);
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.renderable) {
      this.scene.remove(this.renderable);
      Filament.EntityManager.get().destroy(this.renderable);
    }
    // Materials are reference counted and cleaned up automatically
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): { avgUpdateTime: number; updateCount: number } {
    return {
      avgUpdateTime: this.updateCount > 0 ? this.updateTimeAccumulator / this.updateCount : 0,
      updateCount: this.updateCount
    };
  }

  // --------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------

  private updateTransform(position: vec3, rotation: quat, scale: number): void {
    mat4.fromRotationTranslationScale(
      this.transform,
      rotation,
      position,
      [scale, scale, scale]
    );

    if (this.renderable) {
      const tcm = this.engine.getTransformManager();
      const inst = tcm.getInstance(this.renderable);
      tcm.setTransform(inst, this.transform);
    }
  }

  private updateBoostEffect(): void {
    if (!this.material) return;

    const boostIntensity = Math.max(0, 1 - this.boostTime * 0.5);
    this.material.setFloatParameter('boostIntensity', boostIntensity);

    // Spawn boost particles
    if (this.boostTime < 1 && this.particleSystem) {
      this.particleSystem.spawnSparkles(
        this.getWorldPosition(),
        2,
        boostIntensity * 5
      );
    }
  }

  private getWorldPosition(): vec3 {
    const pos = mat4.getTranslation(vec3.create(), this.transform);
    return pos;
  }
}

// ============================================================================
// Factory & Utilities
// ============================================================================

export function createMarbleVisual(
  engine: Filament.Engine,
  scene: Filament.Scene,
  theme: MarbleTheme,
  position: vec3 = vec3.create()
): MarbleVisual {
  return new MarbleVisual(engine, scene, {
    theme,
    position,
    rotation: quat.create()
  });
}

export function getThemeForMarble(marbleId: string): MarbleTheme {
  const themeMap: Record<string, MarbleTheme> = {
    'classic_glass': MarbleTheme.CLASSIC_GLASS,
    'obsidian_metal': MarbleTheme.OBSIDIAN_METAL,
    'neon_glow': MarbleTheme.NEON_GLOW,
    'stone_vein': MarbleTheme.STONE_VEIN,
    'classic_blue': MarbleTheme.CLASSIC_GLASS,
    'classic_red': MarbleTheme.OBSIDIAN_METAL,
    'classic_green': MarbleTheme.STONE_VEIN,
    'cosmic_nebula': MarbleTheme.NEON_GLOW,
    'shadow_ninja': MarbleTheme.OBSIDIAN_METAL,
    'volcanic_magma': MarbleTheme.OBSIDIAN_METAL
  };
  
  return themeMap[marbleId] || MarbleTheme.CLASSIC_GLASS;
}

// Performance validation
export function validatePerformance(metrics: { avgUpdateTime: number }): boolean {
  const TARGET_MS_PER_MARBLE = 0.5;
  return metrics.avgUpdateTime < TARGET_MS_PER_MARBLE;
}

// WebGL2 compatibility check
export function checkWebGL2Support(): boolean {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  return gl !== null;
}

export default MarbleVisual;
