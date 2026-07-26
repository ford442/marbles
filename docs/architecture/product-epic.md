# Product Epic: Competition, Workshop, and Showcase Content

**Status:** North-star (planning) — July 2026  
**Horizon:** 12–18 months  
**Prerequisite:** P0 foundation (quality bar, Phase B, JSON migration, physics worker, WASM) largely green before P1–P4 land in production.

## Vision

Marbles 3D is already a capable browser marble roller: Filament PBR, Rapier physics, JSON levels, map editor, ghost replays, cloud sync spike, Party Race, optional WebGPU particles. The **next product layer** is less “more boxes” and more **shared competition + creator economy + showcase content**.

```
┌─────────────────────────────────────────────────────────┐
│  Seasons / ranked races / ghosts / leaderboards         │
├─────────────────────────────────────────────────────────┤
│  Workshop: publish editor maps (signed, moderated)      │
├─────────────────────────────────────────────────────────┤
│  Handcrafted GLB courses + campaign chapters            │
├─────────────────────────────────────────────────────────┤
│  Runtime: Filament + Rapier + optional physics worker   │
│  Foundation: composed subsystems, typed catalogs, WASM  │
└─────────────────────────────────────────────────────────┘
```

This document is the **single north-star** for what the app becomes. Implementation stays split into child issues/PRs under phases P0–P4.

## Runtime constraint (non-negotiable)

| Layer | Allowed client runtime deps |
|-------|----------------------------|
| Game bundle | **Filament + Rapier only** (`package.json` `dependencies`) |
| Tooling / server | May grow (FastAPI, GCS, relay, validators) |

See [language-strategy.md](./language-strategy.md) and [CURRENT_STATE.md](../CURRENT_STATE.md).

## Phasing

| Phase | Focus | Exit criteria |
|-------|-------|---------------|
| **P0** | Foundation | CI green, Phase B subsystems, manifest migration quality bar, physics worker opt-in, WASM parity |
| **P1** | Workshop read | Community tab or `?map=workshop:<id>` plays CDN-hosted packages (no publish yet) |
| **P2** | Workshop publish | Editor → auth → upload → another browser plays; moderation stubs |
| **P3** | Ranked Party Race | Season playlist, persistent race results, relay hardening |
| **P4** | Launch content | Hero course pack + Season 1 |

**Rule:** Do not start P1 workshop CDN until P0 level/editor validation is stable. Do not ship ranked integrity requirements until [host-authority.md](./host-authority.md) limitations are understood.

## Workstream 1 — Workshop publish

**Extends:** [map-editor.md](./map-editor.md) (editor v2 already exports JSON + workshop ZIP via `workshop-export.js`).

| Layer | Deliverable |
|-------|-------------|
| Backend | Extend `backend/storage` Marbles API (`/v1/marbles/*`) — package upload, listing, report/takedown stubs |
| Client | Editor **Publish** flow → optional account auth → GCS blob + metadata |
| Play | `?map=workshop:<id>` or catalog **Community** tab |
| Validation | Server-side schema (reuse `scripts/validate-assets.cjs` rules) |
| Safety | Size limits, data-only maps (allowlisted zone types, no arbitrary JS) |

**Design detail:** [workshop-platform.md](./workshop-platform.md) (data model + moderation ADR).

**Libraries to evaluate (server/tooling only):** GCS signed upload URLs; `ajv` or Pydantic models mirroring `assets/schemas/` (keep browser deps unchanged).

## Workstream 2 — Ranked Party Race seasons

**Builds on:** [multiplayer.md](../multiplayer.md), [host-authority.md](./host-authority.md), `server/relay.mjs`, `src/game/network/`, `replay-codec`.

| Feature | Notes |
|---------|-------|
| Season structure | Weekly rotating playlist: manifest tracks + featured workshop maps |
| Rating | MMR or simple Elo via existing cloud client (`VITE_MARBLES_API_URL`) |
| Spectator | Receive state stream without local marble |
| Replay share | Deep links using ghost / `replay-codec` pipeline |
| Relay hardening | Auth tokens, rate limits, dedicated deploy for `relay.mjs` |

**Complex / later:** Full prediction reconciliation beyond soft blend; lockstep or headless sim for competitive integrity (see host-authority Option C).

## Workstream 3 — Handcrafted course pack

| Item | Pattern |
|------|---------|
| 3–5 hero levels | GLB track pipeline (`neon_showcase`, `assets/tracks/`) + LOD |
| Look / feel | Existing IBL presets (neon, ice, volcanic, space) |
| Audio | Data-driven sound bank stems |
| Ship gate | After JSON migration quality bar; register in `assets/manifest.json` |

## Epic-level acceptance criteria

- [ ] Design doc / ADR for workshop data model + moderation → [workshop-platform.md](./workshop-platform.md)
- [ ] End-to-end: create in editor → publish → another browser plays map (P2)
- [ ] Ranked mode: 2+ clients complete a race with persistent result (P3)
- [ ] At least one new handcrafted course in production manifest (P4)
- [ ] Client runtime dependency count remains Filament + Rapier only

## Explicit non-goals

- Restoring orphan React sequencer into the game bundle (`docs/backups/orphan-react-stack/`)
- Replacing Filament with custom WebGPU renderer (`docs/backups/experimental-wasm-renderer/`)
- Native mobile apps (PWA path: [mobile-pwa.md](../mobile-pwa.md))

## Child issues (file when P0 is green)

Suggested GitHub issue titles:

1. `P1: Workshop CDN read — catalog tab + ?map=workshop:<id>`
2. `P2: Workshop publish API + editor Publish button`
3. `P2: Workshop moderation — report + takedown stub`
4. `P3: Ranked season playlist + result persistence`
5. `P3: Relay auth + rate limits`
6. `P4: Hero course pack (3–5 GLB levels)`

## Related architecture

| Doc | Relevance |
|-----|-----------|
| [level-pipeline.md](./level-pipeline.md) | Manifest JSON, validation |
| [campaign.md](./campaign.md) | Chapters, medals, cloud merge |
| [map-editor.md](./map-editor.md) | Editor v2, workshop ZIP |
| [host-authority.md](./host-authority.md) | Party Race sim authority |
| [physics-worker.md](./physics-worker.md) | Optional perf path (not ranked authority) |
| [backend/README.md](../../backend/README.md) | Marbles API today |
