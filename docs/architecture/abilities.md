# Ability Registry

Central registry for player abilities. Replaces scattered constructor fields, duplicate cooldown checks, and hard-coded HUD bar wiring for migrated abilities.

## Architecture

| Piece | Path | Role |
|-------|------|------|
| Definitions | `src/abilities/registry.js` | `{ id, cooldown, input, activate, hudSlot, … }` |
| Runtime | `src/game/systems/ability-system.ts` | Masks, keybinds, unified HUD tick, `tryActivate` |
| Implementations | `src/abilities/*.js` | Spawn/update logic (mixins until Phase B) |

**Every** ability is a registry entry (#451 Part E) — `id`, `binding` (`code` + `trigger`: `press` / `hold` / `charge` / `poll`), `cooldownSec`, `activate(ctx, dt)` (plus hold/release hooks) and an explicit `netBit`. `src/init/core.js` and `src/game-loop/frame-input.js` dispatch keys through `AbilitySystem`; there are no per-key ability branches left (`tests/test_ability_bindings.js` enforces this, and that no two abilities — or an ability and a reserved UI/movement key — share a binding).

Network bits are pinned: 0–9 are the original abilities (airdashing, dash, jump, stomp, bomb, missile, blackhole, holo, blink, doublejump) and 10–15 the held movement modifiers (magnet attract/repel, hover, jetpack, glider, phase). The bitfield is full at 16 (`MAX_NETWORKED_ABILITY_IDS`); newer abilities are `netBit: null` (local-only) — growing it is a wire-protocol change. `src/game/network/input-bitfield.js` derives its list from the registry.

Binding changes made to resolve conflicts: magnet repel `Q` → `-` (air dash keeps Q), chameleon `N` → `=` (mute keeps N), missile `L` → `V` (lock-on keeps L).

## Level ability mask

Maps may include:

```json
"abilities": {
  "enabled": ["jump"]
}
```

Or blacklist with `"disabled": ["bomb", "missile"]`. Omit the field to allow all registered abilities. The mask covers every registry entry (including the formerly hard-coded ones such as magnet, hover, portals): a masked ability never activates and its HUD icon hides. Ids must be registered abilities (schema-checked by test).

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
