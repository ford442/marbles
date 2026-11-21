/**
 * Persisted player settings (`localStorage['marbles3d_settings']`).
 *
 * `DEFAULT_SETTINGS` in `init/filament-loader.ts` is the source of truth for
 * the shape and defaults; `InitSettings.mergeWithDefaults` fills any field a
 * saved blob is missing, so after `loadSettings()` every member is present.
 */

/** Graphics tab. `quality` is a tier name: 'low' | 'medium' | 'high' | 'ultra'. */
export interface GraphicsSettings {
    quality: string;
    shadows: boolean;
    /** User bloom slider, 0–100 (50 = tier default strength). */
    bloom: number;
    ssao: boolean;
    renderScale: number;
    dynamicResolution: boolean;
    targetFps: number | 'unlimited';
    /** 'auto' (governor may downshift) | 'locked'. */
    performanceMode: string;
}

/** Audio tab volumes, 0–100. */
export interface AudioSettings {
    master: number;
    sfx: number;
    music: number;
}

/** Touch-controls layout (`input/touch-controls.ts`). */
export interface TouchSettings {
    /** 'auto' | 'on' | 'off'. */
    enabled: string;
    /** 'left' | 'right'. */
    joystickSide: string;
    /** 'primary' | 'secondary'. */
    jumpSlot: string;
    /** 'primary' | 'secondary'. */
    boostSlot: string;
    cameraSensitivity: number;
    invertCameraY: boolean;
    showControls: boolean;
}

export interface ControlSettings {
    /** Mouse sensitivity slider (10–200). */
    sensitivity: number;
    invertY: boolean;
    /** Ability id → key code overrides (`AbilitySystem.exportKeybinds`). */
    keybinds: Record<string, string>;
    /** Older saves may lack fields; readers fall back to `DEFAULT_TOUCH`. */
    touch: Partial<TouchSettings>;
}

export interface AccessibilitySettings {
    /** Percent, 100 = unscaled. */
    uiScale: number;
    highContrast: boolean;
    /** Percent, 100 = full shake. */
    screenShake: number;
}

export interface GameSettings {
    graphics: GraphicsSettings;
    audio: AudioSettings;
    controls: ControlSettings;
    accessibility: AccessibilitySettings;
}

/**
 * Transient graphics downshifts written by `AutoQualityGovernor` (never
 * persisted). `InitSettings.applyGraphicsSettings` layers them over
 * `settings.graphics`.
 */
export interface RuntimeGraphicsOverrides {
    shadowTierDowngrade?: number;
    heavyFxDisabled?: boolean;
    volumetricDisabled?: boolean;
    ssaoDisabled?: boolean;
    dynamicMinScale?: number;
    forceShOnlyIbl?: boolean;
    effectiveQuality?: string;
    shadowsDisabled?: boolean;
}

/**
 * Settings members on the game object. `settings` is unset until
 * `initPauseMenu()` sets it to `null`, then filled by `loadSettings()` at the
 * end of boot; readers guard with `?.`.
 */
export interface SettingsContext {
    settings?: GameSettings | null;
    _runtimeGraphicsOverrides?: RuntimeGraphicsOverrides | null;
}
