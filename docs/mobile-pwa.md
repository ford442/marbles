# Mobile & PWA

Play Marbles 3D on phones and tablets with touch controls, mobile graphics presets, and optional PWA install.

## Touch controls

| Zone | Action |
|------|--------|
| Left joystick | Move (maps to WASD / arrow keys) |
| Right buttons | Jump (primary), Boost (secondary) |
| Right half of screen | Drag to look; pinch to zoom follow distance |

Remap in **Settings → Controls**:

- Touch on/off (Auto / Always / Off)
- Joystick left or right
- Swap Jump / Boost positions
- Touch camera sensitivity and invert Y

Touch overlays appear automatically on mobile (`enabled: auto`) or when forced on in settings.

## Mobile graphics preset

On first launch on a phone/tablet, the game applies:

| Setting | Low-tier device | Mid mobile |
|---------|-----------------|------------|
| Quality | `low` | `medium` |
| Target FPS | 30 | 30 |
| SSAO | off | off |
| Bloom | 20% | 35% |
| Render scale | 85% | 100% |
| Performance mode | auto governor | auto governor |

Low-tier = `deviceMemory ≤ 3` or `hardwareConcurrency ≤ 4`.

The auto quality governor further disables SSR, motion blur, and volumetrics under load.

## Safe area & orientation

- CSS `env(safe-area-inset-*)` pads HUD and touch controls for notched devices.
- Manifest requests `orientation: landscape`.
- Portrait mode shows a non-blocking hint to rotate — gameplay still works in portrait.

## PWA install

### Requirements

Production host must send cross-origin isolation headers (required for Rapier SharedArrayBuffer):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Vite dev/preview already set these in `vite.config.js`.

### Service worker (`public/sw.js`)

- **Caches:** HTML shell, manifest, icon (stale-while-revalidate for other same-origin GETs)
- **Network-first:** `*.wasm`, `filament.js` (large binaries; avoids stale COEP issues)

Register via `src/pwa/register-sw.js` on load.

### Install steps

1. Deploy with COOP/COEP headers.
2. Open in Chrome Android → menu → **Install app** (or Add to Home Screen on iOS Safari).
3. Launch from home screen in landscape.

### Known limitations

| Platform | Limitation |
|----------|------------|
| **iOS Safari** | SharedArrayBuffer may be unavailable → physics falls back or fails; install is “Add to Home Screen” only (no Web Push). |
| **iOS PWA** | `COEP: require-corp` + cross-origin Filament CDN can block WASM; self-host Filament for best results. |
| **Android Chrome** | Installable with manifest + SW; prefer Wi‑Fi first run (~Filament WASM size). |
| **Credentialless** | If third-party CORP blocks assets, consider `Cross-Origin-Embedder-Policy: credentialless` (document tradeoffs before switching). |

## Testing checklist

- [ ] Tutorial completable on mid-range Android Chrome (touch only)
- [ ] Touch remapping persists after Save & Apply
- [ ] 30–60 FPS on `medium` tutorial with mobile preset
- [ ] PWA installs on Android Chrome when served with COOP/COEP

## File map

| File | Purpose |
|------|---------|
| `src/input/touch-controls.js` | Joystick, buttons, camera, pinch |
| `src/platform/mobile-presets.js` | First-run mobile graphics |
| `src/pwa/register-sw.js` | SW registration |
| `public/manifest.webmanifest` | PWA manifest |
| `public/sw.js` | Service worker |
