# Ability Registry

Central registry for player abilities. Replaces scattered constructor fields, duplicate cooldown checks, and hard-coded HUD bar wiring for migrated abilities.

## Architecture

| Piece | Path | Role |
|-------|------|------|
| Definitions | `src/abilities/registry.js` | `{ id, cooldown, input, activate, hudSlot, … }` |
| Runtime | `src/game/systems/ability-system.js` | Masks, keybinds, unified HUD tick, `tryActivate` |
| Implementations | `src/abilities/*.js` | Spawn/update logic (mixins until Phase B) |

Migrated abilities (registry-driven):

- `jump` — charge input; tutorial mask target
- `bomb`, `missile`, `blackhole` — combat projectiles
- `holo` — holo platform (`Backquote` default)
- `blink` — short-range teleport

## Level ability mask

Maps may include:

```json
"abilities": {
  "enabled": ["jump"]
}
```

Or blacklist with `"disabled": ["bomb", "missile"]`. Omit the field to allow all registered abilities.

`tutorial.json` enables **jump only**.

## Custom keybinds (optional)

Saved under `settings.controls.keybinds` in localStorage, e.g. `{ "bomb": "KeyZ" }`. Defaults live in the registry `input.defaultCode`.

## New ability checklist

1. **`src/abilities/registry.js`** — add entry with `id`, `cooldownMs`, `input`, `activate`, `hudSlot`, `hudIconId`.
2. **`src/abilities/<name>.js`** — implement spawn/update logic; export via `src/abilities/index.js` if new file.
3. *(Optional)* `assets/maps/<level>.json` — `abilities.enabled` / `disabled` for level gating.
4. *(Optional)* `index.html` legacy bar markup if the ability needs a new DOM bar (prefer reusing HUDManager icons).

No constructor, input-handler, or `hud-tick.js` edits required for registry-managed abilities.

## Tests

```bash
node tests/test_ability_registry.js
```
