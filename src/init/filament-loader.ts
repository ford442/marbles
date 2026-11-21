import RAPIER from '@dimforge/rapier3d-compat';
import type { FilamentModule } from '../types/filament.ts';
import type { GameSettings } from '../types/settings.ts';

/** UMD global installed by the `filament.js` script tag (absent until it loads). */
declare const Filament: FilamentModule;

// Default settings configuration
const DEFAULT_SETTINGS: GameSettings = {
    graphics: {
        quality: 'medium',
        shadows: true,
        bloom: 50,
        ssao: true,
        renderScale: 1.0,
        dynamicResolution: true,
        targetFps: 60,
        performanceMode: 'auto',
    },
    audio: {
        master: 80,
        sfx: 70,
        music: 50
    },
    controls: {
        sensitivity: 50,
        invertY: false,
        keybinds: {},
        touch: {
            enabled: 'auto',
            joystickSide: 'left',
            jumpSlot: 'primary',
            boostSlot: 'secondary',
            cameraSensitivity: 50,
            invertCameraY: false,
            showControls: true,
        },
    },
    accessibility: {
        uiScale: 100,
        highContrast: false,
        screenShake: 100
    }
};

// Detect WebGL2 support before attempting Filament init
function detectWebGL2(): boolean {
    try {
        const testCanvas = document.createElement('canvas')
        const gl = testCanvas.getContext('webgl2')
        if (!gl) return false
        // Confirm it's a real WebGL2 context
        return typeof gl.createVertexArray === 'function'
    } catch {
        return false
    }
}

export async function loadFilament(): Promise<FilamentModule> {
    // Fast-fail if WebGL2 is unavailable — Filament requires it
    if (!detectWebGL2()) {
        throw new Error('WebGL 2.0 is not supported or failed to initialize in this browser.')
    }

    let attempts = 0
    while (typeof Filament === 'undefined' && attempts < 100) {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        attempts++
    }

    console.log('[INIT] Filament available after', attempts, 'attempts:', typeof Filament)
    if (typeof Filament === 'undefined') {
        throw new Error('Filament not loaded. Make sure filament.js is included as a script tag.')
    }

    if (typeof Filament.init === 'function' && !Filament.isReady) {
        // Guard against indefinite hang: apply a 20-second timeout
        await Promise.race([
            new Promise<void>(resolve => Filament.init([], resolve)),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Filament WASM initialization timed out (20 s). WebGL may not be available.')), 20000)
            )
        ])
    }

    if (Filament.loadGeneratedExtensions) Filament.loadGeneratedExtensions()
    if (Filament.loadClassExtensions) Filament.loadClassExtensions()

    console.log('[INIT] Filament loaded globally:', typeof Filament, Object.keys(Filament || {}).slice(0, 10))
    return Filament
}

export { DEFAULT_SETTINGS };
