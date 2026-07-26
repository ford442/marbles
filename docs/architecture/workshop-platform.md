# ADR: Workshop Platform — Data Model and Moderation

**Status:** Proposed — July 2026  
**Epic:** [product-epic.md](./product-epic.md) (Workstream 1)  
**Related:** [map-editor.md](./map-editor.md), [level-pipeline.md](./level-pipeline.md), [backend/README.md](../../backend/README.md)

## Context

The map editor v2 can export schema-valid JSON and a client-side **workshop ZIP** (`src/editor/workshop-export.js`) containing `map.json` plus referenced GLB assets. There is no server publish path, community catalog, or moderation.

We need a **data-only** UGC model: maps are JSON + binary assets, validated against the same rules as shipped content (`scripts/validate-assets.cjs`, `assets/schemas/`). No user-supplied JavaScript in packages.

## Decision

### 1. Package format

Reuse the editor workshop ZIP layout as the canonical upload blob:

```
workshop-package.zip
├── map.json              # MapDefinition (same schema as assets/maps/*.json)
├── manifest.json         # Workshop metadata (see below)
└── assets/               # Only paths referenced by map zones
    └── tracks/...
```

`map.json` must pass the same validation as production maps. Zone `type` values must be in the **allowlist** union of:

- Built-in editor stamps (see [map-editor.md](./map-editor.md))
- Registered factory stamps in `src/zone-setup/registry.js`
- `model` zones with `model` paths under `assets/tracks/` (bundled in ZIP or known CDN prefix)

Reject uploads containing `script`, `behaviors` with executable hooks, or unknown zone types.

### 2. Workshop metadata (`manifest.json` inside package)

```json
{
  "schemaVersion": 1,
  "id": "uuid-v4",
  "title": "Neon Spiral",
  "description": "Short blurb for catalog UI",
  "authorId": "device-uuid-or-account-id",
  "authorDisplayName": "optional",
  "createdAt": "2026-07-26T12:00:00.000Z",
  "updatedAt": "2026-07-26T12:00:00.000Z",
  "gameVersion": "1.0.0",
  "thumbnailUrl": "optional-https-url",
  "tags": ["neon", "expert"],
  "contentRating": "everyone",
  "sourceEditor": "map-editor-v2"
}
```

Server assigns canonical `id` on first publish if client omits it. `authorId` ties to existing `Authorization: Bearer <device-uuid>` pattern used by `/v1/marbles/*`.

### 3. GCS object layout

Extends current Marbles API bucket layout:

```
marbles/workshop/packages/{mapId}/package.zip
marbles/workshop/packages/{mapId}/meta.json      # denormalized listing row
marbles/workshop/packages/{mapId}/thumbnail.webp # optional
marbles/workshop/index/recent.json               # curated listing pages
marbles/workshop/index/featured.json
marbles/workshop/reports/{reportId}.json         # moderation queue
```

Public **read** URLs (CDN or signed GET with long TTL) for `package.zip` and thumbnails. **Write** via signed POST/PUT URLs issued by API after auth + pre-validation.

### 4. API surface (extends `/v1/marbles`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/marbles/workshop/upload-url` | Auth → signed GCS URL + `mapId` |
| `POST` | `/v1/marbles/workshop/{mapId}/finalize` | Server validates ZIP, promotes to listed |
| `GET` | `/v1/marbles/workshop` | Paginated catalog (`?sort=recent\|featured`) |
| `GET` | `/v1/marbles/workshop/{mapId}` | Metadata + download URL |
| `POST` | `/v1/marbles/workshop/{mapId}/report` | Player report stub |
| `POST` | `/v1/marbles/workshop/{mapId}/takedown` | Admin/mod only (stub) |

P1 (read-only) may serve static `index/*.json` from CDN without upload routes.

### 5. Client play path

1. **Catalog tab “Community”** loads `GET /v1/marbles/workshop` or static index.
2. **Deep link:** `?map=workshop:<mapId>` fetches metadata, downloads ZIP, registers via `registerCustomLevel()` / workshop loader (new thin module in `src/levels/`).
3. Runtime uses existing zone registry + GLTF loader — no new renderer dependency.

### 6. Validation pipeline

On `finalize`:

1. Size cap (e.g. 25 MB ZIP, 50 MB unpacked).
2. Unzip to temp; virus scan optional (future).
3. Run equivalent of `validate-assets.cjs` on `map.json` (Python: port rules or subprocess Node in CI).
4. Verify every file path in ZIP ⊆ allowlist; no `..` segments.
5. Hash package; store in `meta.json` for cache busting.

Client-side pre-check in editor before upload (reuse `map-validator.js`) reduces failed finalize rate.

### 7. Moderation (stubs → production)

| Stage | Behavior |
|-------|----------|
| **P1 read-only** | Only team-curated maps in `featured.json` |
| **P2 publish** | New uploads `status: pending` until auto-scan passes; visible as `unlisted` until featured |
| **Report** | `POST report` appends to `reports/` with reason enum (`spam`, `broken`, `offensive`, `other`) |
| **Takedown** | Sets `meta.status = removed`; CDN object retained 30d for audit |

No in-game chat — UGC risk is map geometry/text fields only. `title`/`description` length limits + profanity filter optional.

### 8. Auth

Reuse device UUID bearer tokens from campaign sync. Optional future: OAuth link for creator display name. Publish rate limit: e.g. 5 uploads / day / `authorId`.

## Alternatives considered

| Option | Rejected because |
|--------|------------------|
| Store only `map.json` in GCS, assets by URL | Broken links, SSRF risk, inconsistent play |
| GitHub-based workshop | Poor UX for non-dev creators; moderation harder |
| Embed JS plugins in maps | Violates runtime dependency rule; security |

## Consequences

- **Positive:** Same validation as shipped levels; editor ZIP maps 1:1 to server blob; cloud client patterns reusable.
- **Negative:** Server must run schema validation; storage costs scale with UGC; moderation needs ops even with stubs.
- **Neutral:** Workshop maps stay out of `assets/manifest.json` until manually promoted to “featured official” content.

## Implementation checklist (P1 → P2)

- [ ] `WorkshopLoader` client module: fetch ZIP → extract in memory → `registerCustomLevel`
- [ ] Catalog UI tab + `?map=workshop:<id>` routing in level loader
- [ ] FastAPI routes + GCS signed URLs
- [ ] Python validator sharing rules with `validate-assets.cjs`
- [ ] Editor **Publish** button (progress, error surfacing)
- [ ] Report/takedown admin script or minimal dashboard

## References

- Editor export: `src/editor/workshop-export.js`
- Schemas: `assets/schemas/`
- Cloud client: `src/services/cloud-client.js` (or equivalent)
- Existing ghosts API pattern: `POST /v1/marbles/ghosts`
