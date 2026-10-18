/**
 * Marble catalog as data (#451 Part E): assets/marbles/*.json is the source of
 * truth, src/marbles_data.js is generated from it, the restitution rule holds
 * (≤ 1 outside the bouncyCap list), only 1 + rivals marbles spawn, and locked
 * or premium marbles can't be selected.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marblesInfo } from '../src/marbles_data.js';
import {
    BOUNCY_CAP_HARD_MAX, DEFAULT_MARBLE_ID, MAX_RESTITUTION, bouncyCapLimits, findCatalogProblems,
} from '../src/marbles/catalog-format.js';
import {
    MAX_RIVALS, SELECTED_MARBLE_STORAGE_KEY, getSelectedMarbleId, isMarbleUnlocked,
    resolveSpawnRoster, selectMarble,
} from '../src/marbles/selection.js';
import { loadCatalog, marbleFilesOnDisk, OUTPUT_PATH, renderMarblesData } from '../scripts/generate-marbles-data.mjs';
import { HeadlessGame, initHeadlessRapier } from '../src/game/headless/headless-level.js';
import { MarbleRegistry } from '../src/game/systems/marble-registry.js';

console.log('test_marbles.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const byName = (name) => marblesInfo.find((m) => m.name === name);

// ── Generated file is current and the catalog is clean ──────────────────────
{
    const { infos, problems } = loadCatalog();
    assert.deepEqual(problems, [], 'catalog problems');
    assert.equal(fs.readFileSync(OUTPUT_PATH, 'utf8'), renderMarblesData(infos), 'src/marbles_data.js is stale: npm run gen:marbles');
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8'));
    assert.equal(marblesInfo.length, Object.keys(manifest.marbles).length, 'one generated entry per manifest marble');
    assert.equal(marbleFilesOnDisk().length, marblesInfo.length, 'every marble JSON file is in the manifest');
    assert.equal(marblesInfo.length, 94, '87 ported JS marbles (9 merged into existing JSON) + 16 JSON marbles');
}

// ── No id / name collisions ─────────────────────────────────────────────────
{
    const ids = marblesInfo.map((m) => m.id);
    const names = marblesInfo.map((m) => m.name.toLowerCase());
    assert.equal(new Set(ids).size, ids.length, 'unique ids');
    assert.equal(new Set(names).size, names.length, 'unique names');
    // The old Void Walker clash: the JSON shadow_ninja and the premium JS marble are distinct.
    assert.equal(marblesInfo.find((m) => m.id === 'shadow_ninja')?.name, 'Shadow Ninja');
    assert.equal(marblesInfo.find((m) => m.id === 'void_walker')?.name, 'Void Walker');

    const def = (id, name, restitution = 0.5) => ({ def: { id, name, physics: { restitution } } });
    const dupId = findCatalogProblems([def('a', 'A'), def('a', 'B')]);
    assert.ok(dupId.some((p) => p.includes('id collision')), 'generator rejects duplicate ids');
    const dupName = findCatalogProblems([def('a', 'Same'), def('b', 'same')]);
    assert.ok(dupName.some((p) => p.includes('name collision')), 'generator rejects duplicate names (case-insensitive)');
}

// ── Restitution ≤ 1 unless listed in _bouncy-cap.json (≤ 1.5) ────────────────
{
    const cap = bouncyCapLimits(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'marbles', '_bouncy-cap.json'), 'utf8')));
    assert.ok(Object.keys(cap).length > 0 && Object.keys(cap).length <= 5, 'bouncyCap is a short, explicit list');
    for (const m of marblesInfo) {
        const limit = cap[m.id] ?? MAX_RESTITUTION;
        assert.ok((m.restitution ?? 0.5) <= limit, `${m.id}: restitution ${m.restitution} > ${limit}`);
        assert.ok(limit <= BOUNCY_CAP_HARD_MAX);
    }
    const def = (restitution) => [{ def: { id: 'x', name: 'X', physics: { restitution } } }];
    assert.ok(findCatalogProblems(def(1.2)).length > 0, '1.2 without a bouncyCap entry fails');
    assert.deepEqual(findCatalogProblems(def(1.2), { bouncyCap: { x: 1.4 } }), [], 'listed marble may exceed 1.0');
    assert.ok(findCatalogProblems(def(1.45), { bouncyCap: { x: 1.4 } }).length > 0, 'its own cap still applies');
    assert.ok(findCatalogProblems(def(1.2), { bouncyCap: { x: 2 } }).length > 0, 'cap above the hard max is rejected');
}

// ── Ported roster keeps its look ────────────────────────────────────────────
{
    assert.equal(byName('Digital Cube')?.geometry, 'cube');
    assert.equal(byName('Chameleon')?.rainbow, true);
    assert.ok(byName('Sun')?.emissive && byName('Sun').lightIntensity === 60000, 'emissive intensity is a ×10000 multiplier');
    assert.equal(byName('Ghost')?.materialType, 'classicGlass');
    assert.equal(byName('Obsidian')?.anisotropy, 0.8, 'shader params survive');
    assert.equal(byName('Feather')?.linearDamping, 3.0);
    assert.equal(marblesInfo.filter((m) => m.premium).length, 16, 'the 16 premium marbles are flagged');
    assert.ok(marblesInfo.filter((m) => m.premium).every((m) => m.unlock === 'premium'));
}

// ── Unlock gating + selection ───────────────────────────────────────────────
function memoryStorage() {
    const store = new Map();
    return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
}
{
    const premium = marblesInfo.find((m) => m.premium);
    const campaign = marblesInfo.find((m) => m.unlock === 'campaign');
    const free = marblesInfo.find((m) => m.unlock === 'default' && m.id !== DEFAULT_MARBLE_ID);
    assert.ok(premium && campaign && free);
    assert.ok(isMarbleUnlocked(free, []), 'default marbles are free');
    assert.ok(!isMarbleUnlocked(campaign, []) && isMarbleUnlocked(campaign, [campaign.id]), 'campaign marbles need the unlock');
    assert.ok(!isMarbleUnlocked(premium, []) && isMarbleUnlocked(premium, [premium.id]), 'premium marbles need a grant');
    assert.ok(!isMarbleUnlocked({ ...premium, unlock: 'default' }, []), 'premium is never free, whatever unlock says');

    const storage = memoryStorage();
    const ctx = { catalog: marblesInfo, unlockedIds: [], storage };
    assert.deepEqual(selectMarble(premium.id, ctx), { ok: false, reason: 'locked' }, 'locked premium marble cannot be selected');
    assert.deepEqual(selectMarble(campaign.id, ctx), { ok: false, reason: 'locked' });
    assert.deepEqual(selectMarble('no_such_marble', ctx), { ok: false, reason: 'unknown' });
    assert.equal(storage.getItem(SELECTED_MARBLE_STORAGE_KEY), null, 'refused selections are not persisted');
    assert.equal(getSelectedMarbleId(ctx), DEFAULT_MARBLE_ID);

    assert.deepEqual(selectMarble(free.id, ctx), { ok: true, id: free.id });
    assert.equal(getSelectedMarbleId(ctx), free.id, 'selection persists');

    run('Obsidian', ['color', 'radius', 'density', 'friction', 'restitution']);
    run('Digital Cube', ['geometry: \'cube\'', 'color', 'radius', 'density']);
    run('Sun', ['color', 'radius', 'density', 'emissive: true', 'lightIntensity']);
    run('Chameleon', ['rainbow: true']);
    run('Crystal', ['color', 'radius', 'density', 'friction', 'restitution', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Ghost', ['color', 'radius', 'density', 'gravityScale', 'friction', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Quasar', ['color', 'radius', 'density', 'restitution', 'friction', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Aether', ['color', 'radius', 'density', 'gravityScale', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Radiant Spark', ['color', 'radius', 'density', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Supernova', ['color', 'radius', 'density', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Galactic Core', ['color', 'radius', 'density', 'friction', 'restitution', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Thunderbolt', ['color', 'radius', 'density', 'gravityScale', 'restitution', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Echo Prism', ['color', 'radius', 'density', 'emissive: true', 'lightIntensity']);
    run('Sapphire Bullet', ['color', 'radius', 'density', 'friction', 'restitution', 'materialType: "glass"', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Celestial Pearl', ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Abyssal Eye', ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Void Walker', ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Ethereal Juggernaut', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Hyper-Bouncing Prism', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Astral Jumper', ['color', 'radius', 'density', 'restitution', 'gravityScale', 'friction', 'roughness', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Phantom Glass', ['color', 'radius', 'density', 'friction', 'restitution', 'roughness', 'gravityScale', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Aegis Diamond', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Omega Titan', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Infinity Glass', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Quantum Phoenix', ['color', 'radius', 'density', 'friction', 'restitution', 'gravityScale', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Nebula Smasher', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Cosmic Prism', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Hypernova Glass', ['color', 'radius', 'density', 'restitution', 'friction', 'clearCoat', 'clearCoatRoughness', 'materialType: "glass"', 'emissive: true', 'lightIntensity', 'lightColor']);
    run('Chronos Jewel', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Starlight Ruby', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Celestial Juggernaut', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Galactic Titan', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Quantum Leviathan', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Quantum Obliterator', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Celestial Singularity', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Astral Behemoth', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Aetherium Catalyst', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Vortex Annihilator', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Astral Juggernaut', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Cosmic Singularity', ['color', 'radius', 'density', 'friction', 'restitution', 'gravityScale', 'clearCoat', 'clearCoatRoughness', 'thickness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Radiant Nova', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'thickness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    run('Nebula Smasher Core', ['color', 'radius', 'density', 'friction', 'restitution', 'clearCoat', 'clearCoatRoughness', 'thickness', 'emissive: true', 'lightIntensity', 'lightColor', 'materialType: "glass"']);
    // A stored id that is (no longer) unlocked falls back to the default.
    storage.setItem(SELECTED_MARBLE_STORAGE_KEY, premium.id);
    assert.equal(getSelectedMarbleId(ctx), DEFAULT_MARBLE_ID);
    assert.equal(getSelectedMarbleId({ ...ctx, unlockedIds: [premium.id] }), premium.id);
}

// ── Spawn roster: player + rivals (≤ 6) ─────────────────────────────────────
{
    const ids = marblesInfo.map((m) => m.id);
    const roster = resolveSpawnRoster({ catalog: marblesInfo, playerId: ids[3], rivals: [ids[5], ids[6], ids[3], 'nope', ids[5]] });
    assert.deepEqual(roster.map((m) => m.id), [ids[3], ids[5], ids[6]], 'player first; unknown and duplicate rivals dropped');
    const many = resolveSpawnRoster({ catalog: marblesInfo, playerId: ids[0], rivals: ids.slice(1, 12) });
    assert.equal(many.length, 1 + MAX_RIVALS);
    assert.equal(resolveSpawnRoster({ catalog: marblesInfo, playerId: 'nope' })[0].id, DEFAULT_MARBLE_ID);

    // MarbleRegistry.createMarbles in a real (headless) Rapier world.
    await initHeadlessRapier();
    for (const rivals of [[], ['super_bouncy', 'void_walker', 'cosmic_nebula']]) {
        const game = new HeadlessGame();
        game.currentLevel = 'test_level';
        game.levelLoader = { getLevel: () => ({ rivals }) };
        const registry = new MarbleRegistry(game);
        registry.createMarbles({ x: 0, y: 2, z: 0 });
        assert.equal(game.marbles.length, 1 + rivals.length, `spawns 1 + ${rivals.length} marbles, not the whole roster`);
        assert.equal(game.world.bodies.len(), 1 + rivals.length);
        assert.equal(game.playerMarble, game.marbles[0]);
        assert.equal(game.playerMarble.id, DEFAULT_MARBLE_ID);
        assert.deepEqual(game.marbles.slice(1).map((m) => m.id), rivals);
        assert.ok(game.marbles.slice(1).every((m) => m.isRival));
    }
}

console.log(`✓ Marble catalog OK (${marblesInfo.length} marbles)`);
