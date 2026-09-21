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

- **Precache on install:** reads `dist/precache-manifest.json` (generated at build time by `vite.config.js` — see below) and caches every WASM binary, `.glb`/`.filmat`/`.mat`/`.ktx` asset, level/marble/sound JSON definition, and the built JS/CSS bundle. Falls back to just the HTML shell + manifest + icon if the manifest can't be fetched (e.g. `npm run dev`, where nothing is built yet).
- **Cache-first, background-refreshed:** WASM binaries, GLB/material/skybox assets, and the JS/CSS bundle (`ASSET_CACHE_RE` in `sw.js`) — instant repeat loads, with a silent background re-fetch to pick up updates.
- **Network-first with cache fallback:** calls to the cloud backend (`/v1/marbles/...`, i.e. `VITE_MARBLES_API_URL`) — fresh data when online, last-known-good when offline.
- **Stale-while-revalidate:** everything else same-origin (HTML, manifest, icon).

Register via `src/pwa/register-sw.js` on load.

#### Asset pre-cache manifest

`vite.config.js`'s `copyAssetsPlugin` writes `dist/precache-manifest.json` after
each production build: every file under `dist/` whose extension is one the SW
needs for offline play (`.wasm .glb .gltf .filmat .filament .mat .ktx .ktx2
.js .css .json`), plus `index.html`, `manifest.webmanifest`, and `icon.svg`.
The SW fetches this list on install and caches it in one pass, so a single
online visit is enough to play every shipped level offline (~14 MB total as
of the 24-map manifest).

#### Background Sync (cloud queue)

`CloudClient` (`src/game/network/cloud-client.ts`) queues progress/ghost
writes in `localStorage` (`CLOUD_QUEUE_KEY`) when the cloud API is
unreachable, and already flushes that queue on the browser's `online` event.
When a write is queued *while offline*, it additionally registers a
`cloud-flush` Background Sync tag so the browser can wake the service worker
once connectivity returns, even if the `online` event is missed. Because the
queue lives in `localStorage` — which service workers can't read — the SW's
`sync` handler can't flush it directly; it instead posts a message to any
open tab, which runs the same in-page flush. **This means a fully closed tab
still needs to be reopened once to actually send queued writes** — Background
Sync here buys resilience against missed `online` events, not a truly
backgrounded flush. Unsupported browsers (Safari) simply keep relying on the
`online` listener.

#### Install prompt

`src/pwa/install-prompt.js` captures `beforeinstallprompt`, suppresses the
browser's own mini-infobar, and shows a dismissible "Install Marbles 3D"
banner (`#install-banner` in `src/ui/templates/menus.html`) on the main menu
once `src/pwa/pwa-state.js` records that the player has finished at least one
level. Dismissal is remembered in `localStorage` and the banner won't
reappear that session. No-ops on browsers without the event (Firefox, Safari).

#### Shortcuts & share target

- **Shortcuts** (`public/manifest.webmanifest`): "Quick Play" launches
  `?shortcut=quickplay`, which `src/pwa/shortcuts.js` resolves to the last
  level the player finished (tracked alongside the install-prompt flag);
  "Campaign" just opens the app to its default level-select screen.
- **Share target**: sharing a workshop level URL to the installed app (e.g.
  from another player's chat link) opens `?shared_workshop_url=<url>`;
  `src/pwa/share-target.js` fetches it, imports it the same way the map
  editor's workshop-package import does, and drops it into "Community
  Levels" on the level-select screen.

#### Periodic Background Sync (leaderboard refresh)

Where supported and permitted (`periodic-background-sync` permission —
currently installed PWAs on Chrome/Android only), `src/pwa/register-sw.js`
registers a `leaderboard-refresh` tag with a ~24h minimum interval. The SW's
`periodicsync` handler re-fetches any leaderboard responses already sitting
in its API cache so scores are reasonably fresh even if the app hasn't been
opened. It only refreshes leaderboards a player has already viewed — it can't
discover new ones on its own.

### Install steps

1. Deploy with COOP/COEP headers.
2. Open in Chrome Android → menu → **Install app** (or Add to Home Screen on iOS Safari).
3. Launch from home screen in landscape.

### Known limitations

| Platform | Limitation |
|----------|------------|
| **iOS Safari** | SharedArrayBuffer may be unavailable → physics falls back or fails; install is “Add to Home Screen” only (no Web Push, no Background Sync, no `beforeinstallprompt`). |
| **iOS PWA** | `COEP: require-corp` + cross-origin Filament CDN can block WASM; self-host Filament for best results. |
| **Android Chrome** | Installable with manifest + SW; prefer Wi‑Fi first run (~14 MB precache as of the 24-map manifest). |
| **Credentialless** | If third-party CORP blocks assets, consider `Cross-Origin-Embedder-Policy: credentialless` (document tradeoffs before switching). |
| **Background Sync** | Flushes the cloud queue by waking an *open* tab, not a fully closed one — the queue lives in `localStorage`, which the SW can't read directly. |
| **Periodic Background Sync** | Chromium-only, and only after the browser grants the `periodic-background-sync` permission (typically after the PWA is installed and used a few times); Safari/Firefox never get it and rely on a normal visit to refresh leaderboards. |

## Testing checklist

- [ ] Tutorial completable on mid-range Android Chrome (touch only)
- [ ] Touch remapping persists after Save & Apply
- [ ] 30–60 FPS on `medium` tutorial with mobile preset
- [ ] PWA installs on Android Chrome when served with COOP/COEP
- [ ] After one online visit, reloading fully offline still reaches the level menu and a level loads and plays
- [ ] Install banner appears on the main menu after finishing a level (once, and stays dismissed after "Not now")
- [ ] Cloud queue (progress/ghosts) flushes automatically after going back online
- [ ] Lighthouse PWA audit ≥ 90

## File map

| File | Purpose |
|------|---------|
| `src/input/touch-controls.js` | Joystick, buttons, camera, pinch |
| `src/platform/mobile-presets.js` | First-run mobile graphics |
| `src/pwa/register-sw.js` | SW registration + periodic sync registration + SW→page flush relay |
| `src/pwa/install-prompt.js` | `beforeinstallprompt` capture + menu banner |
| `src/pwa/pwa-state.js` | "Has played a level" / "last played level" flags |
| `src/pwa/shortcuts.js` | Resolves the manifest's Quick Play shortcut |
| `src/pwa/share-target.js` | Imports a shared workshop level URL into Community Levels |
| `public/manifest.webmanifest` | PWA manifest (icons, screenshots, shortcuts, share target) |
| `public/screenshots/` | App-store screenshots referenced by the manifest |
| `public/sw.js` | Service worker (precache, cache strategies, background/periodic sync) |
| `vite.config.js` | Generates `dist/precache-manifest.json` at build time |
