/**
 * Environment configuration resolver
 */

import {
  EnvironmentConfig,
  DefaultEnvironmentConfig,
  RenderingQualityProfileName
} from '../../marble_rendering_layer';

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
