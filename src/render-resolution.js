// Centralized render-resolution helpers.
//
// The game historically sized the Filament backing store to the CSS pixel
// dimensions (window.innerWidth/innerHeight), i.e. an effective device-pixel
// ratio of 1. That keeps the pixel count low (good for FPS) but looks soft on
// high-DPI displays. These helpers add a user-controllable `renderScale` so the
// resolution can be lowered for more frames or raised for a sharper image,
// without changing the default behaviour (renderScale = 1.0 reproduces the old
// CSS-pixel sizing exactly).

export const MIN_RENDER_SCALE = 0.5;
export const MAX_RENDER_SCALE = 2.0;
export const DEFAULT_RENDER_SCALE = 1.0;

export function clampRenderScale(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_RENDER_SCALE;
    return Math.min(MAX_RENDER_SCALE, Math.max(MIN_RENDER_SCALE, n));
}

// Compute the CSS (layout) size and the backing-store (render buffer) size for
// the canvas. The buffer is the CSS size multiplied by the render scale.
export function getRenderDimensions(settings) {
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;
    const scale = clampRenderScale(settings?.graphics?.renderScale);
    const bufferWidth = Math.max(1, Math.round(cssWidth * scale));
    const bufferHeight = Math.max(1, Math.round(cssHeight * scale));
    return { cssWidth, cssHeight, bufferWidth, bufferHeight, scale };
}

// Filament dynamic resolution lets the GPU automatically lower the internal
// render target when it can't keep up, then scale back up when there's
// headroom — protecting framerate while staying as sharp as possible. The
// result is upscaled with a sharpening filter so the quality hit is minimal.
export function applyDynamicResolution(view, Filament, enabled) {
    if (!view || typeof view.setDynamicResolutionOptions !== 'function') return;
    try {
        const QualityLevel = Filament?.['View$QualityLevel'];
        view.setDynamicResolutionOptions({
            enabled: enabled !== false,
            homogeneousScaling: true,
            minScale: [0.5, 0.5],
            maxScale: [1.0, 1.0],
            sharpness: 0.9,
            quality: QualityLevel ? QualityLevel.MEDIUM : 1,
        });
    } catch (e) {
        console.warn('[RENDER] Dynamic resolution update failed:', e);
    }
}
