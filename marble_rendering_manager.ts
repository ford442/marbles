/**
 * Marble Rendering Manager
 * Runtime system for managing materials, effects, and post-processing
 */

import {
  MarbleRenderingPackage,
  AllMarbleRenderingPackages,
  ClassicGlassMarble,
  ObsidianMetalMarble,
  NeonGlowMarble,
  StoneVeinMarble,
  ParticleEffect,
  PostProcessConfig,
  ReflectionProbeConfig,
  RenderingQualityProfile,
  RenderingQualityProfileName,
  RenderingQualityProfiles,
  TrackZoneVisualMetadata,
  TrackSurfaceVisualProperties,
  EnvironmentConfig,
  DefaultEnvironmentConfig,
  FilamentMaterialBuilder,
  createPostProcessPipeline
} from './marble_rendering_layer';

// ============================================================================
// TYPES
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Transform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

interface MarbleInstance {
  id: string;
  type: string;
  transform: Transform;
  velocity: Vector3;
  angularVelocity: Vector3;
  isBoosting: boolean;
  lodLevel: number;
  impostorActive: boolean;
}

interface Particle {
  position: Vector3;
  velocity: Vector3;
  lifetime: number;
  maxLifetime: number;
  size: number;
  color: [number, number, number, number];
  active: boolean;
}

interface ManagedReflectionProbe extends ReflectionProbeConfig {
  lastUpdate: number;
  hasAwakened: boolean;
  renderTarget: any;
}

export interface RenderingManagerInitializationOptions {
  environmentConfig?: Partial<EnvironmentConfig> | Record<string, any>;
  trackData?: any;
}

// ============================================================================
// RENDERING MANAGER
// ============================================================================

export class MarbleRenderingManager {
  private engine: any;
  private scene: any;
  private view: any;
  private camera: any;

  // Material cache
  private materials: Map<string, any> = new Map();
  private materialBuilders: Map<string, FilamentMaterialBuilder> = new Map();

  // Instance management
  private marbleInstances: Map<string, MarbleInstance> = new Map();
  private instancedMeshes: Map<string, any> = new Map();

  // Particle systems
  private particlePools: Map<string, Particle[]> = new Map();
  private activeParticles: Particle[] = [];
  private particleMeshes: Map<string, any> = new Map();

  // Post-processing
  private postProcessTargets: Map<string, any> = new Map();
  private currentPostProcess: string | null = null;

  // Environment
  private reflectionProbes: ManagedReflectionProbe[] = [];
  private environmentMap: any = null;
  private reflectionProbeCursor: number = 0;

  // Quality & tuning
  private qualityProfileName: RenderingQualityProfileName = 'high';
  private qualityProfile: RenderingQualityProfile = RenderingQualityProfiles.high;
  private lodHysteresisMeters: number = this.qualityProfile.lodHysteresisMeters;

  // Optional per-zone visual metadata for track surfaces
  private trackZoneVisuals: Map<string, TrackSurfaceVisualProperties> = new Map();

  // Performance
  private frameCount: number = 0;
  private lastTime: number = 0;
  private avgFrameTime: number = 0;

  constructor(engine: any, scene: any, view: any, camera: any) {
    this.engine = engine;
    this.scene = scene;
    this.view = view;
    this.camera = camera;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize all marble materials
   */
  initializeMaterials(): void {
    for (const pkg of AllMarbleRenderingPackages) {
      const builder = new FilamentMaterialBuilder(pkg.materialConfig);
      const material = builder.build(this.engine);

      this.materials.set(pkg.name, material);
      this.materialBuilders.set(pkg.name, builder);

      console.log(`[MarbleRenderer] Initialized material: ${pkg.name}`);
    }
  }

  /**
   * Initialize particle systems
   */
  initializeParticleSystems(): void {
    const allEffects = new Set<ParticleEffect>();

    for (const pkg of AllMarbleRenderingPackages) {
      for (const effect of pkg.particleEffects) {
        allEffects.add(effect);
      }
    }

    for (const effect of allEffects) {
      // Initialize particle pool
      const pool: Particle[] = [];
      for (let i = 0; i < effect.maxParticles; i++) {
        pool.push({
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          lifetime: 0,
          maxLifetime: 0,
          size: 0,
          color: [1, 1, 1, 1],
          active: false
        });
      }
      this.particlePools.set(effect.name, pool);

      // Create particle mesh (billboard quad)
      const particleMesh = this.createParticleMesh(effect);
      this.particleMeshes.set(effect.name, particleMesh);

      console.log(`[MarbleRenderer] Initialized particle system: ${effect.name}`);
    }
  }

  /**
   * Initialize environment and reflection system
   */
  initializeEnvironment(config: EnvironmentConfig = DefaultEnvironmentConfig): void {
    this.setRenderingQualityProfile(config.qualityProfile);

    // Load environment map for IBL
    if (config.skybox.texture) {
      this.loadEnvironmentMap(config.skybox.texture, config.iblIntensity);
    }

    this.applyDirectionalLight(config.directionalLight);
    this.applyShadowConfig(config.shadow);

    // Create reflection probes
    this.reflectionProbes = [];
    for (const probeConfig of config.reflectionProbes) {
      const probe = this.createReflectionProbe(probeConfig);
      this.reflectionProbes.push(probe);
    }

    // Setup skybox
    if (config.skybox.enabled) {
      this.setupSkybox(config.skybox);
    }

    console.log('[MarbleRenderer] Environment initialized');
  }

  /**
   * Initialize post-processing pipeline
   */
  initializePostProcessing(marbleType: string): void {
    const pkg = this.getPackage(marbleType);
    if (!pkg) return;

    const pipeline = createPostProcessPipeline(
      pkg.postProcessConfig,
      this.engine,
      this.qualityProfileName
    );
    this.applyPostProcessPipeline(pipeline);

    this.currentPostProcess = marbleType;
    console.log(`[MarbleRenderer] Post-processing initialized for: ${marbleType}`);
  }

  // ============================================================================
  // MARBLE INSTANCE MANAGEMENT
  // ============================================================================

  /**
   * Create a new marble instance
   */
  createMarble(id: string, type: string, transform: Transform): MarbleInstance {
    const marble: MarbleInstance = {
      id,
      type,
      transform,
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      isBoosting: false,
      lodLevel: 0,
      impostorActive: false
    };

    this.marbleInstances.set(id, marble);

    // Create renderable entity
    this.createMarbleRenderable(marble);

    console.log(`[MarbleRenderer] Created marble: ${id} (${type})`);
    return marble;
  }

  /**
   * Update marble transform and state
   */
  updateMarble(id: string, transform: Transform, velocity: Vector3,
    angularVelocity: Vector3, isBoosting: boolean): void {
    const marble = this.marbleInstances.get(id);
    if (!marble) return;

    marble.transform = transform;
    marble.velocity = velocity;
    marble.angularVelocity = angularVelocity;
    marble.isBoosting = isBoosting;

    // Update LOD
    this.updateLOD(marble);

    // Update particle effects
    this.updateParticleEffects(marble);
  }

  /**
   * Remove a marble instance
   */
  removeMarble(id: string): void {
    const marble = this.marbleInstances.get(id);
    if (!marble) return;

    // Remove renderable
    this.removeMarbleRenderable(marble);

    this.marbleInstances.delete(id);
    console.log(`[MarbleRenderer] Removed marble: ${id}`);
  }

  // ============================================================================
  // LOD & INSTANCING
  // ============================================================================

  /**
   * Update LOD level based on distance and visibility
   */
  private updateLOD(marble: MarbleInstance): void {
    const cameraPos = this.getCameraPosition();
    const marblePos = marble.transform.position;

    const dx = cameraPos.x - marblePos.x;
    const dy = cameraPos.y - marblePos.y;
    const dz = cameraPos.z - marblePos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const pkg = this.getPackage(marble.type);
    if (!pkg) return;

    const newLOD = this.resolveLodWithHysteresis(
      marble.lodLevel,
      distance,
      pkg,
      this.lodHysteresisMeters
    );
    const useImpostor = this.resolveImpostorState(
      marble.impostorActive,
      distance,
      pkg,
      this.lodHysteresisMeters
    );

    // Apply changes if needed
    if (newLOD !== marble.lodLevel || useImpostor !== marble.impostorActive) {
      marble.lodLevel = newLOD;
      marble.impostorActive = useImpostor;
      this.updateMarbleRenderableLOD(marble);
    }
  }

  /**
   * Setup instancing for multiple marbles of same type
   */
  setupInstancing(marbleType: string, maxInstances: number): void {
    const material = this.materials.get(marbleType);
    if (!material) return;

    // Create instanced mesh
    // Note: This is pseudo-code - actual Filament API differs
    const instancedMesh = {
      type: marbleType,
      maxInstances,
      instances: new Map<string, any>(),
      material
    };

    this.instancedMeshes.set(marbleType, instancedMesh);
    console.log(`[MarbleRenderer] Setup instancing for: ${marbleType} (${maxInstances} max)`);
  }

  // ============================================================================
  // PARTICLE EFFECTS
  // ============================================================================

  /**
   * Update particle effects based on marble state
   */
  private updateParticleEffects(marble: MarbleInstance): void {
    const speed = Math.sqrt(
      marble.velocity.x ** 2 +
      marble.velocity.y ** 2 +
      marble.velocity.z ** 2
    );

    const pkg = this.getPackage(marble.type);
    if (!pkg) return;

    for (const effect of pkg.particleEffects) {
      switch (effect.trigger) {
        case 'speed':
          if (speed > (effect.triggerThreshold || 0)) {
            this.emitSpeedSparkles(marble, effect, speed);
          }
          break;

        case 'boost':
          if (marble.isBoosting) {
            this.emitBoostEffect(marble, effect);
          }
          break;

        case 'continuous':
          this.emitContinuousTrail(marble, effect);
          break;

        case 'impact':
          // Handled by external impact event
          break;
      }
    }
  }

  /**
   * Emit speed-based sparkle particles
   */
  private emitSpeedSparkles(marble: MarbleInstance, effect: ParticleEffect,
    speed: number): void {
    const emissionCount = Math.floor((speed - (effect.triggerThreshold || 0)) * 0.5);

    for (let i = 0; i < emissionCount; i++) {
      const particle = this.getFreeParticle(effect.name);
      if (!particle) continue;

      // Position at marble surface, trailing behind
      const velocityDir = {
        x: -marble.velocity.x / speed,
        y: -marble.velocity.y / speed,
        z: -marble.velocity.z / speed
      };

      const offset = 0.5 + Math.random() * 0.3;
      particle.position = {
        x: marble.transform.position.x + velocityDir.x * offset,
        y: marble.transform.position.y + velocityDir.y * offset,
        z: marble.transform.position.z + velocityDir.z * offset
      };

      // Random spread
      const spread = effect.velocity.spread;
      particle.velocity = {
        x: velocityDir.x * effect.velocity.speed + (Math.random() - 0.5) * spread,
        y: velocityDir.y * effect.velocity.speed + (Math.random() - 0.5) * spread + 0.5,
        z: velocityDir.z * effect.velocity.speed + (Math.random() - 0.5) * spread
      };

      particle.lifetime = effect.lifetime.min +
        Math.random() * (effect.lifetime.max - effect.lifetime.min);
      particle.maxLifetime = particle.lifetime;
      particle.size = effect.size.start;
      particle.color = [...effect.color.start] as [number, number, number, number];
      particle.active = true;

      this.activeParticles.push(particle);
    }
  }

  /**
   * Emit boost flame/jet effect
   */
  private emitBoostEffect(marble: MarbleInstance, effect: ParticleEffect): void {
    const particlesToEmit = Math.floor(effect.emissionRate * 0.016); // Assuming 60fps

    for (let i = 0; i < particlesToEmit; i++) {
      const particle = this.getFreeParticle(effect.name);
      if (!particle) continue;

      // Emit from opposite direction of velocity
      const speed = Math.sqrt(
        marble.velocity.x ** 2 +
        marble.velocity.y ** 2 +
        marble.velocity.z ** 2
      );

      if (speed < 0.1) continue;

      const dir = {
        x: -marble.velocity.x / speed,
        y: -marble.velocity.y / speed,
        z: -marble.velocity.z / speed
      };

      particle.position = {
        x: marble.transform.position.x + dir.x * 0.4,
        y: marble.transform.position.y + dir.y * 0.4,
        z: marble.transform.position.z + dir.z * 0.4
      };

      // Spread cone
      const spread = effect.velocity.spread;
      particle.velocity = {
        x: dir.x * Math.abs(effect.velocity.speed) + (Math.random() - 0.5) * spread,
        y: dir.y * Math.abs(effect.velocity.speed) + (Math.random() - 0.5) * spread,
        z: dir.z * Math.abs(effect.velocity.speed) + (Math.random() - 0.5) * spread
      };

      particle.lifetime = effect.lifetime.min +
        Math.random() * (effect.lifetime.max - effect.lifetime.min);
      particle.maxLifetime = particle.lifetime;
      particle.size = effect.size.start * (0.8 + Math.random() * 0.4);
      particle.color = [...effect.color.start] as [number, number, number, number];
      particle.active = true;

      this.activeParticles.push(particle);
    }
  }

  /**
   * Emit continuous trail effect
   */
  private emitContinuousTrail(marble: MarbleInstance, effect: ParticleEffect): void {
    const particle = this.getFreeParticle(effect.name);
    if (!particle) return;

    particle.position = { ...marble.transform.position };

    // Slight random spread
    const spread = effect.velocity.spread;
    particle.velocity = {
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      z: (Math.random() - 0.5) * spread
    };

    particle.lifetime = effect.lifetime.min +
      Math.random() * (effect.lifetime.max - effect.lifetime.min);
    particle.maxLifetime = particle.lifetime;
    particle.size = effect.size.start;
    particle.color = [...effect.color.start] as [number, number, number, number];
    particle.active = true;

    this.activeParticles.push(particle);
  }

  /**
   * Trigger impact burst at position
   */
  triggerImpactBurst(marbleId: string, impactForce: number, position: Vector3): void {
    const marble = this.marbleInstances.get(marbleId);
    if (!marble) return;

    const pkg = this.getPackage(marble.type);
    if (!pkg) return;

    for (const effect of pkg.particleEffects) {
      if (effect.trigger === 'impact' && impactForce >= (effect.triggerThreshold || 0)) {
        this.emitImpactParticles(position, effect, impactForce);
      }
    }
  }

  private emitImpactParticles(position: Vector3, effect: ParticleEffect,
    force: number): void {
    const count = Math.min(effect.maxParticles, Math.floor(force * 5));

    for (let i = 0; i < count; i++) {
      const particle = this.getFreeParticle(effect.name);
      if (!particle) break;

      particle.position = { ...position };

      // Radial burst
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = effect.velocity.speed * (0.5 + Math.random() * 0.5);

      particle.velocity = {
        x: Math.sin(phi) * Math.cos(theta) * speed,
        y: Math.cos(phi) * speed,
        z: Math.sin(phi) * Math.sin(theta) * speed
      };

      particle.lifetime = effect.lifetime.min +
        Math.random() * (effect.lifetime.max - effect.lifetime.min);
      particle.maxLifetime = particle.lifetime;
      particle.size = effect.size.start;
      particle.color = [...effect.color.start] as [number, number, number, number];
      particle.active = true;

      this.activeParticles.push(particle);
    }
  }

  private getFreeParticle(effectName: string): Particle | null {
    const pool = this.particlePools.get(effectName);
    if (!pool) return null;

    for (const particle of pool) {
      if (!particle.active) {
        return particle;
      }
    }
    return null;
  }

  // ============================================================================
  // RENDER LOOP
  // ============================================================================

  /**
   * Main render update
   */
  update(deltaTime: number, currentTime: number): void {
    // Update material uniforms
    this.updateMaterialUniforms(currentTime);

    // Update particles
    this.updateParticles(deltaTime);

    // Update reflection probes (if needed)
    this.updateReflectionProbes(currentTime);

    // Update instancing
    this.updateInstancing();

    // Performance tracking
    this.trackPerformance(deltaTime);
  }

  /**
   * Update material uniforms for time-based effects
   */
  private updateMaterialUniforms(time: number): void {
    for (const [name, material] of this.materials) {
      // Update uTime uniform
      // Actual Filament code would set uniform buffer
      if (material.uniforms && material.uniforms.uTime) {
        material.uniforms.uTime.value = time;
      }
    }
  }

  /**
   * Update all active particles
   */
  private updateParticles(deltaTime: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const particle = this.activeParticles[i];

      if (!particle.active) {
        this.activeParticles.splice(i, 1);
        continue;
      }

      // Update lifetime
      particle.lifetime -= deltaTime;
      if (particle.lifetime <= 0) {
        particle.active = false;
        this.activeParticles.splice(i, 1);
        continue;
      }

      // Update position
      particle.position.x += particle.velocity.x * deltaTime;
      particle.position.y += particle.velocity.y * deltaTime;
      particle.position.z += particle.velocity.z * deltaTime;

      // Apply gravity (simplified - would use effect-specific acceleration)
      particle.velocity.y -= 2.0 * deltaTime;

      // Update size and color based on lifetime
      const lifeRatio = particle.lifetime / particle.maxLifetime;
      // Size interpolation would happen here
      // Color interpolation would happen here
    }
  }

  /**
   * Update reflection probes
   */
  private updateReflectionProbes(time: number): void {
    if (this.reflectionProbes.length === 0) return;

    const updatesPerFrame = Math.max(1, this.qualityProfile.maxProbeUpdatesPerFrame);
    let updates = 0;

    // Stagger probe updates across frames to reduce spikes.
    for (let i = 0; i < this.reflectionProbes.length && updates < updatesPerFrame; i++) {
      const idx = (this.reflectionProbeCursor + i) % this.reflectionProbes.length;
      const probe = this.reflectionProbes[idx];

      let shouldUpdate = false;
      if (probe.updateMode === 'realtime') {
        shouldUpdate = true;
      } else if (probe.updateMode === 'onAwake' && !probe.hasAwakened) {
        shouldUpdate = true;
        probe.hasAwakened = true;
      } else if (probe.updateMode === 'scheduled') {
        const interval = Math.max(0.016, probe.updateInterval);
        shouldUpdate = time - probe.lastUpdate >= interval;
      }

      if (shouldUpdate) {
        this.renderReflectionProbe(probe);
        probe.lastUpdate = time;
        updates += 1;
      }
    }

    this.reflectionProbeCursor = (this.reflectionProbeCursor + updatesPerFrame) % this.reflectionProbes.length;
  }

  /**
   * Update instanced rendering
   */
  private updateInstancing(): void {
    for (const [type, mesh] of this.instancedMeshes) {
      // Group marbles by type and update instance buffer
      const instances: MarbleInstance[] = [];
      for (const marble of this.marbleInstances.values()) {
        if (marble.type === type) {
          instances.push(marble);
        }
      }

      // Update instance data
      this.updateInstanceBuffer(mesh, instances);
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getPackage(type: string): MarbleRenderingPackage | undefined {
    return AllMarbleRenderingPackages.find(p => p.name === type);
  }

  private getCameraPosition(): Vector3 {
    // Return camera position from Filament camera
    return { x: 0, y: 10, z: 20 }; // Placeholder
  }

  private createMarbleRenderable(marble: MarbleInstance): void {
    // Create renderable entity in Filament
    // Placeholder implementation
  }

  private removeMarbleRenderable(marble: MarbleInstance): void {
    // Remove renderable entity
  }

  private updateMarbleRenderableLOD(marble: MarbleInstance): void {
    // Switch mesh/material based on LOD level
  }

  private createParticleMesh(effect: ParticleEffect): any {
    // Create billboard quad mesh for particles
    return {};
  }

  private loadEnvironmentMap(path: string, intensity: number): void {
    // Load HDR environment map
  }

  private createReflectionProbe(config: ReflectionProbeConfig): ManagedReflectionProbe {
    const scaledResolution = Math.floor(config.resolution * this.qualityProfile.probeResolutionScale);

    return {
      ...config,
      resolution: Math.max(64, scaledResolution),
      lastUpdate: 0,
      hasAwakened: false,
      renderTarget: null
    };
  }

  private resolveLodWithHysteresis(
    currentLOD: number,
    distance: number,
    pkg: MarbleRenderingPackage,
    hysteresisMeters: number
  ): number {
    const levels = pkg.lodConfig.levels;
    let lod = Math.max(0, Math.min(currentLOD, levels.length - 1));

    while (lod < levels.length - 1) {
      const nextThreshold = levels[lod + 1].distance + hysteresisMeters;
      if (distance >= nextThreshold) {
        lod += 1;
      } else {
        break;
      }
    }

    while (lod > 0) {
      const currentThreshold = levels[lod].distance - hysteresisMeters;
      if (distance < currentThreshold) {
        lod -= 1;
      } else {
        break;
      }
    }

    return lod;
  }

  private resolveImpostorState(
    currentState: boolean,
    distance: number,
    pkg: MarbleRenderingPackage,
    hysteresisMeters: number
  ): boolean {
    if (!pkg.lodConfig.impostor.enabled) return false;

    const threshold = pkg.lodConfig.impostor.distance;
    if (currentState) {
      return distance >= threshold - hysteresisMeters;
    }
    return distance >= threshold + hysteresisMeters;
  }

  private applyDirectionalLight(config: EnvironmentConfig['directionalLight']): void {
    if (!config.enabled) return;

    // Best-effort integration across engine wrappers.
    const sceneAny = this.scene as any;
    const viewAny = this.view as any;

    if (typeof sceneAny?.setDirectionalLight === 'function') {
      sceneAny.setDirectionalLight({
        direction: config.direction,
        color: config.color,
        intensity: config.intensity,
        castShadows: config.castShadows
      });
      return;
    }

    if (typeof viewAny?.setDirectionalLight === 'function') {
      viewAny.setDirectionalLight({
        direction: config.direction,
        color: config.color,
        intensity: config.intensity,
        castShadows: config.castShadows
      });
    }
  }

  private applyShadowConfig(config: EnvironmentConfig['shadow']): void {
    if (!config.enabled) return;

    // Best-effort integration across engine wrappers.
    const viewAny = this.view as any;
    const sceneAny = this.scene as any;

    if (typeof viewAny?.setShadowOptions === 'function') {
      viewAny.setShadowOptions(config);
      return;
    }

    if (typeof sceneAny?.setShadowOptions === 'function') {
      sceneAny.setShadowOptions(config);
    }
  }

  applyTrackRenderingConfiguration(
    trackData: any,
    environmentConfig?: Partial<EnvironmentConfig> | Record<string, any>
  ): void {
    const zoneMetadata = buildTrackZoneVisualMetadataFromTrack(trackData);
    this.setTrackZoneVisualMetadata(zoneMetadata);

    if (environmentConfig) {
      this.initializeEnvironment(resolveEnvironmentConfig(environmentConfig));
    }
  }

  setRenderingQualityProfile(profileName: RenderingQualityProfileName): void {
    this.qualityProfileName = profileName;
    this.qualityProfile = RenderingQualityProfiles[profileName];
    this.lodHysteresisMeters = this.qualityProfile.lodHysteresisMeters;
  }

  setTrackZoneVisualMetadata(entries: TrackZoneVisualMetadata[]): void {
    this.trackZoneVisuals.clear();
    for (const entry of entries) {
      this.trackZoneVisuals.set(entry.zoneId, this.normalizeSurfaceVisuals(entry.surface));
    }
  }

  getTrackZoneVisualMetadata(zoneId: string): TrackSurfaceVisualProperties | undefined {
    return this.trackZoneVisuals.get(zoneId);
  }

  private normalizeSurfaceVisuals(surface: TrackSurfaceVisualProperties): TrackSurfaceVisualProperties {
    const clamp01 = (value: number | undefined, fallback: number): number => {
      if (value === undefined || Number.isNaN(value)) return fallback;
      return Math.max(0, Math.min(1, value));
    };

    const clamp02 = (value: number | undefined, fallback: number): number => {
      if (value === undefined || Number.isNaN(value)) return fallback;
      return Math.max(0, Math.min(2, value));
    };

    return {
      surfaceType: surface.surfaceType,
      roughnessOverride: clamp01(surface.roughnessOverride, 0.5),
      metallicOverride: clamp01(surface.metallicOverride, 0.0),
      reflectionIntensity: clamp02(surface.reflectionIntensity, 1.0),
      shadowIntensity: clamp01(surface.shadowIntensity, 1.0),
      shadowSoftness: clamp01(surface.shadowSoftness, 0.5)
    };
  }

  private renderReflectionProbe(probe: any): void {
    // Render cubemap from probe position
  }

  private setupSkybox(config: any): void {
    // Setup skybox renderable
  }

  private applyPostProcessPipeline(pipeline: any): void {
    // Apply post-process settings to view
  }

  private updateInstanceBuffer(mesh: any, instances: MarbleInstance[]): void {
    // Update GPU instance buffer
  }

  private trackPerformance(deltaTime: number): void {
    this.frameCount++;
    this.avgFrameTime = this.avgFrameTime * 0.99 + deltaTime * 0.01;

    if (this.frameCount % 60 === 0) {
      console.log(`[MarbleRenderer] FPS: ${(1.0 / this.avgFrameTime).toFixed(1)}, ` +
        `Active particles: ${this.activeParticles.length}, ` +
        `Marbles: ${this.marbleInstances.size}`);
    }
  }

  // ============================================================================
  // DEBUG & UTILITIES
  // ============================================================================

  /**
   * Get debug statistics
   */
  getStats(): object {
    return {
      marbleCount: this.marbleInstances.size,
      activeParticles: this.activeParticles.length,
      avgFrameTime: this.avgFrameTime,
      fps: 1.0 / this.avgFrameTime,
      materials: Array.from(this.materials.keys()),
      lodDistribution: this.getLODDistribution()
    };
  }

  private getLODDistribution(): Record<number, number> {
    const dist: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    for (const marble of this.marbleInstances.values()) {
      dist[marble.lodLevel] = (dist[marble.lodLevel] || 0) + 1;
    }
    return dist;
  }

  /**
   * Force LOD level for all marbles (debug)
   */
  forceLOD(level: number): void {
    for (const marble of this.marbleInstances.values()) {
      marble.lodLevel = level;
      this.updateMarbleRenderableLOD(marble);
    }
  }

  /**
   * Set post-processing intensity
   */
  setPostProcessIntensity(effect: keyof PostProcessConfig, intensity: number): void {
    // Update post-process settings
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createRenderingManager(
  engine: any,
  scene: any,
  view: any,
  camera: any,
  options?: RenderingManagerInitializationOptions
): MarbleRenderingManager {
  const manager = new MarbleRenderingManager(engine, scene, view, camera);

  manager.initializeMaterials();
  manager.initializeParticleSystems();

  const resolvedEnvironment = resolveEnvironmentConfig(options?.environmentConfig);
  manager.initializeEnvironment(resolvedEnvironment);

  if (options?.trackData) {
    const metadata = buildTrackZoneVisualMetadataFromTrack(options.trackData);
    manager.setTrackZoneVisualMetadata(metadata);
  }

  return manager;
}

export function resolveEnvironmentConfig(
  input?: Partial<EnvironmentConfig> | Record<string, any>
): EnvironmentConfig {
  if (!input) {
    return DefaultEnvironmentConfig;
  }

  const parsed = input as Record<string, any>;
  const fallback = DefaultEnvironmentConfig;

  const directionalLight = {
    ...fallback.directionalLight,
    ...(parsed.directionalLight ?? {})
  };

  const shadow = {
    ...fallback.shadow,
    ...(parsed.shadow ?? {})
  };

  const skybox = {
    ...fallback.skybox,
    ...(parsed.skybox ?? {})
  };

  return {
    qualityProfile: (parsed.qualityProfile ?? fallback.qualityProfile) as RenderingQualityProfileName,
    iblIntensity: typeof parsed.iblIntensity === 'number' ? parsed.iblIntensity : fallback.iblIntensity,
    iblRotation: typeof parsed.iblRotation === 'number' ? parsed.iblRotation : fallback.iblRotation,
    reflectionProbes: Array.isArray(parsed.reflectionProbes) ? parsed.reflectionProbes : fallback.reflectionProbes,
    directionalLight,
    shadow,
    skybox
  };
}

export function loadMarblePackage(type: string): MarbleRenderingPackage | null {
  switch (type) {
    case 'ClassicGlass': return ClassicGlassMarble;
    case 'ObsidianMetal': return ObsidianMetalMarble;
    case 'NeonGlow': return NeonGlowMarble;
    case 'StoneVein': return StoneVeinMarble;
    default: return null;
  }
}

export function buildTrackZoneVisualMetadataFromTrack(track: any): TrackZoneVisualMetadata[] {
  const zones = Array.isArray(track) ? track : track?.zones;
  if (!Array.isArray(zones)) return [];

  const metadata: TrackZoneVisualMetadata[] = [];
  for (let index = 0; index < zones.length; index++) {
    const zone = zones[index];
    const surface = zone?.surface;
    if (!surface || typeof surface !== 'object') continue;

    const zoneId = zone?.props?.zone !== undefined
      ? String(zone.props.zone)
      : `zone_${index}`;

    metadata.push({
      zoneId,
      surface,
      reflectionProbeHint: zone?.reflection_probe_hint
    });
  }

  return metadata;
}
