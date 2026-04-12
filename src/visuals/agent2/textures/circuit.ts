/**
 * Circuit pattern texture generation
 * Agent 2: Complexity Layer
 */

import { CircuitPatternConfig } from '../../types';
import { initializeTextureCanvas, textureCanvas, textureContext, lerp, smoothstep } from './shared';

/**
 * Create an animated circuit pattern texture
 * Generates hexagonal, square, or radial circuit patterns
 * 
 * @param config - Circuit pattern configuration
 * @param time - Animation time in seconds
 * @returns ImageData containing the generated pattern
 */
export function createCircuitPattern(
  config: CircuitPatternConfig,
  time: number = 0
): ImageData {
  initializeTextureCanvas();
  const { width, height } = { width: config.resolution, height: config.resolution };
  
  textureCanvas!.width = width;
  textureCanvas!.height = height;
  
  const imageData = textureContext!.createImageData(width, height);
  const data = imageData.data;
  
  const [bgR, bgG, bgB] = config.backgroundColor;
  const [circuitR, circuitG, circuitB] = config.circuitColor;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      
      let circuitValue = 0;
      
      switch (config.gridType) {
        case 'hex':
          circuitValue = generateHexCircuit(u, v, config, time);
          break;
        case 'square':
          circuitValue = generateSquareCircuit(u, v, config, time);
          break;
        case 'radial':
          circuitValue = generateRadialCircuit(u, v, config, time);
          break;
      }
      
      // Apply glow
      const glow = Math.pow(circuitValue, 0.5) * config.glowIntensity;
      const finalValue = Math.min(1, circuitValue + glow * 0.3);
      
      const r = lerp(bgR, circuitR, finalValue);
      const g = lerp(bgG, circuitG, finalValue);
      const b = lerp(bgB, circuitB, finalValue);
      
      const idx = (y * width + x) * 4;
      data[idx] = Math.floor(r * 255);
      data[idx + 1] = Math.floor(g * 255);
      data[idx + 2] = Math.floor(b * 255);
      data[idx + 3] = 255;
    }
  }
  
  return imageData;
}

/**
 * Generate hexagonal circuit pattern
 */
export function generateHexCircuit(
  u: number,
  v: number,
  config: CircuitPatternConfig,
  time: number
): number {
  const hexSize = 1.0 / config.density;
  const hexW = hexSize * Math.sqrt(3);
  const hexH = hexSize * 1.5;
  
  // Hex coordinates
  const row = Math.floor(v / hexH);
  const col = Math.floor(u / hexW + (row % 2) * 0.5);
  
  // Local position in hex
  const localU = (u - col * hexW + (row % 2) * hexW * 0.5) / hexSize;
  const localV = (v - row * hexH) / hexSize;
  
  // Distance from hex center
  const dx = localU - Math.sqrt(3) / 2;
  const dy = localV - 0.5;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);
  
  // Hex edge distance
  const hexDist = Math.max(
    Math.abs(dx),
    Math.abs(dx * 0.5 + dy * Math.sqrt(3) / 2),
    Math.abs(dx * 0.5 - dy * Math.sqrt(3) / 2)
  );
  
  // Animated circuit lines
  const anim = Math.sin(time * config.animationSpeed * 2 + row * 0.5 + col * 0.3) * 0.5 + 0.5;
  const lineWidth = config.lineThickness * hexSize;
  const edgeDist = Math.abs(hexDist - (0.8 - anim * 0.3));
  
  return smoothstep(lineWidth * 2, 0, edgeDist);
}

/**
 * Generate square circuit pattern
 */
export function generateSquareCircuit(
  u: number,
  v: number,
  config: CircuitPatternConfig,
  time: number
): number {
  const cellSize = 1.0 / config.density;
  
  const col = Math.floor(u / cellSize);
  const row = Math.floor(v / cellSize);
  
  const localU = (u - col * cellSize) / cellSize;
  const localV = (v - row * cellSize) / cellSize;
  
  // Animated energy flow
  const flow = (time * config.animationSpeed + col * 0.1) % 1;
  
  // Grid lines
  const lineWidth = config.lineThickness;
  const hLine = smoothstep(lineWidth, 0, Math.abs(localV - 0.5));
  const vLine = smoothstep(lineWidth, 0, Math.abs(localU - 0.5));
  
  // Corner nodes
  const cornerDist = Math.min(
    Math.sqrt(localU * localU + localV * localV),
    Math.sqrt((1 - localU) * (1 - localU) + localV * localV),
    Math.sqrt(localU * localU + (1 - localV) * (1 - localV)),
    Math.sqrt((1 - localU) * (1 - localU) + (1 - localV) * (1 - localV))
  );
  const node = smoothstep(lineWidth * 3, 0, cornerDist);
  
  // Energy pulse along lines
  const pulse = Math.exp(-Math.pow((localU - flow) * 10, 2));
  
  return Math.max(hLine, vLine, node * 0.7) + pulse * 0.3;
}

/**
 * Generate radial circuit pattern
 */
export function generateRadialCircuit(
  u: number,
  v: number,
  config: CircuitPatternConfig,
  time: number
): number {
  const cx = 0.5;
  const cy = 0.5;
  
  const dx = u - cx;
  const dy = v - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  const rings = config.density * 2;
  const radialLines = Math.floor(config.density * 8);
  
  // Concentric rings
  const ringDist = Math.sin(dist * Math.PI * rings * 2) * 0.5 + 0.5;
  const ringPattern = smoothstep(config.lineThickness * 2, 0, 1 - ringDist);
  
  // Radial spokes
  const spokeAngle = (angle / (Math.PI * 2) * radialLines + time * config.animationSpeed) % 1;
  const spokePattern = smoothstep(config.lineThickness, 0, Math.min(spokeAngle, 1 - spokeAngle));
  
  // Central hub
  const hub = smoothstep(0.15, 0, dist);
  
  // Data streams
  const stream = Math.sin(dist * 20 - time * config.animationSpeed * 5) * 0.5 + 0.5;
  const streamPattern = stream * smoothstep(0.4, 0, Math.abs(dist - 0.25));
  
  return Math.max(ringPattern * 0.5, spokePattern * 0.8, hub, streamPattern * 0.6);
}
