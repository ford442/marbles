/**
 * Internal types for Marble Rendering Manager
 */

import { ReflectionProbeConfig } from '../../marble_rendering_layer';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Transform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface MarbleInstance {
  id: string;
  type: string;
  transform: Transform;
  velocity: Vector3;
  angularVelocity: Vector3;
  isBoosting: boolean;
  lodLevel: number;
  impostorActive: boolean;
}

export interface Particle {
  position: Vector3;
  velocity: Vector3;
  lifetime: number;
  maxLifetime: number;
  size: number;
  color: [number, number, number, number];
  active: boolean;
}

export interface ManagedReflectionProbe extends ReflectionProbeConfig {
  lastUpdate: number;
  hasAwakened: boolean;
  renderTarget: any;
}

export interface RenderingManagerInitializationOptions {
  environmentConfig?: Partial<import('../../marble_rendering_layer').EnvironmentConfig> | Record<string, any>;
  trackData?: any;
}
