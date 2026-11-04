/**
 * Level Format v2 primitives (src/zone-setup/primitives.ts): the type list
 * agrees everywhere it is spelled out, the pure compile step produces the
 * geometry the schema promises, and ZoneScope animates, triggers and
 * disposes what a level built.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    PRIMITIVE_TYPES, compilePrimitive, pointInBody, ZoneScope,
} from '../../src/zone-setup/primitives.ts';
import { PRIMITIVE_ZONE_TYPES } from '../../src/levels/map-normalize.js';
import { quatRotateVec3 } from '../../src/math.ts';
import { ROOT } from './level-sources.js';
import { buildHeadlessLevel, stepHeadless } from '../../src/game/headless/headless-level.js';
import { mapToRuntimeLevel } from '../../src/levels/map-normalize.js';

console.log('test_primitives.js');

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const vecClose = (v, w, eps = 1e-6) => close(v.x, w.x, eps) && close(v.y, w.y, eps) && close(v.z, w.z, eps);

// ── One type list: builder, loader, schema, Python publish check ────────────
const sorted = (xs) => [...xs].sort();
assert.deepEqual(sorted(PRIMITIVE_ZONE_TYPES), sorted(PRIMITIVE_TYPES), 'map-normalize.js PRIMITIVE_ZONE_TYPES');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'schemas', 'map-schema.json'), 'utf8'));
for (const t of PRIMITIVE_TYPES) assert.ok(schema.definitions[`${t}Zone`], `map-schema.json defines ${t}Zone`);
const py = fs.readFileSync(path.join(ROOT, 'backend', 'storage', 'services', 'map_validation.py'), 'utf8');
const pyTypes = [...(py.match(/PRIMITIVE_ZONE_TYPES = frozenset\(\{([^}]*)\}\)/)?.[1] ?? '').matchAll(/"(\w+)"/g)].map((m) => m[1]);
assert.deepEqual(sorted(pyTypes), sorted(PRIMITIVE_TYPES), 'map_validation.py PRIMITIVE_ZONE_TYPES');
const handlers = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'schemas', 'zone-handlers.json'), 'utf8')).handlers;
for (const t of PRIMITIVE_TYPES) assert.ok(handlers.includes(t), `zone-handlers.json lists ${t}`);

// ── Ramp: the top surface runs from → to ────────────────────────────────────
{
    const from = { x: 2, y: 4, z: 0 };
    const to = { x: 2, y: 0, z: 20 };
    const { body } = compilePrimitive({ type: 'ramp', from: [2, 4, 0], to: [2, 0, 20], width: 6, thickness: 1 });
    const topAt = (zSign) => {
        const local = { x: 0, y: body.halfExtents.y, z: zSign * body.halfExtents.z };
        const r = quatRotateVec3(body.rot, local);
        return { x: body.pos.x + r.x, y: body.pos.y + r.y, z: body.pos.z + r.z };
    };
    assert.ok(vecClose(topAt(-1), from), `ramp top starts at from (got ${JSON.stringify(topAt(-1))})`);
    assert.ok(vecClose(topAt(1), to), `ramp top ends at to (got ${JSON.stringify(topAt(1))})`);
    assert.ok(close(body.halfExtents.x, 3) && close(body.halfExtents.y, 0.5), 'ramp width/thickness are full extents');
    assert.equal(body.kind, 'fixed');
}

// ── Box: size is full extents; named-axis rotation; surface presets ─────────
{
    const { body } = compilePrimitive({ type: 'box', pos: [1, 2, 3], size: [4, 2, 6], rot: { yawDeg: 90 }, material: 'ice' });
    assert.ok(vecClose(body.halfExtents, { x: 2, y: 1, z: 3 }));
    assert.ok(vecClose(quatRotateVec3(body.rot, { x: 0, y: 0, z: 1 }), { x: 1, y: 0, z: 0 }), 'yawDeg 90 turns +Z to +X');
    assert.ok(body.friction < 0.1, 'ice preset gives low friction');
    const explicit = compilePrimitive({ type: 'box', pos: [0, 0, 0], size: [1, 1, 1], material: 'ice', friction: 0.5 }).body;
    assert.equal(explicit.friction, 0.5, 'explicit friction beats the preset');
}

// ── Mover: ping-pong along the path, phase offsets, kinematic ───────────────
{
    const c = compilePrimitive({ type: 'mover', size: [2, 1, 2], path: [[0, 0, 0], [10, 0, 0]], period: 4, ease: 'linear' });
    assert.equal(c.body.kind, 'kinematic');
    assert.ok(vecClose(c.poseAt(0).pos, { x: 0, y: 0, z: 0 }));
    assert.ok(vecClose(c.poseAt(1).pos, { x: 5, y: 0, z: 0 }));
    assert.ok(vecClose(c.poseAt(2).pos, { x: 10, y: 0, z: 0 }), 'reaches the end at half period');
    assert.ok(vecClose(c.poseAt(3).pos, { x: 5, y: 0, z: 0 }), 'comes back');
    const phased = compilePrimitive({ type: 'mover', size: [2, 1, 2], path: [[0, 0, 0], [10, 0, 0]], period: 4, ease: 'linear', phase: 0.5 });
    assert.ok(vecClose(phased.poseAt(0).pos, { x: 10, y: 0, z: 0 }), 'phase 0.5 starts at the far end');
}

// ── Spinner: rpm about its axis ─────────────────────────────────────────────
{
    const c = compilePrimitive({ type: 'spinner', pos: [0, 1, 0], size: [8, 1, 1], axis: 'y', rpm: 15 });
    const tip = (t) => quatRotateVec3(c.poseAt(t).rot, { x: 1, y: 0, z: 0 });
    assert.ok(vecClose(tip(0), { x: 1, y: 0, z: 0 }));
    assert.ok(vecClose(tip(1), { x: 0, y: 0, z: -1 }), '15 rpm turns a quarter per second (yaw +90° maps +X to -Z)');
}

// ── Trigger: sensor volume, enter vs stay ───────────────────────────────────
{
    const c = compilePrimitive({ type: 'trigger', pos: [0, 0, 0], size: [2, 2, 2], do: { boost: [0, 5, 0] } });
    assert.equal(c.body.kind, 'sensor');
    assert.ok(pointInBody(c.body, { x: 0.9, y: 0, z: 0 }) && !pointInBody(c.body, { x: 1.1, y: 0, z: 0 }));

    const fakeBody = (p) => {
        const v = { x: 0, y: 0, z: 0 };
        return {
            p, v,
            translation: () => p, linvel: () => v, mass: () => 2,
            setLinvel(n) { Object.assign(v, n); },
            applyImpulse(i) { v.x += i.x / 2; v.y += i.y / 2; v.z += i.z / 2; },
            setNextKinematicTranslation() {}, setNextKinematicRotation() {},
        };
    };
    for (const on of ['enter', 'stay']) {
        const scope = new ZoneScope();
        scope.addTrigger(c.body, on, c.trigger.action);
        const rb = fakeBody({ x: 0, y: 0, z: 0 });
        const host = { marbles: [{ rigidBody: rb }] };
        scope.tick(host, 1 / 60);
        scope.tick(host, 1 / 60);
        assert.ok(close(rb.v.y, on === 'enter' ? 5 : 10), `${on}: boost is a velocity change (got ${rb.v.y})`);
        rb.p.x = 5; scope.tick(host, 1 / 60);
        rb.p.x = 0; scope.tick(host, 1 / 60);
        assert.ok(close(rb.v.y, on === 'enter' ? 10 : 15), `${on}: re-entering fires again`);
    }
}

// ── ZoneScope: drives kinematics from sim time, pauses, disposes everything ─
{
    const scope = new ZoneScope();
    const c = compilePrimitive({ type: 'mover', size: [1, 1, 1], path: [[0, 0, 0], [0, 4, 0]], period: 2, ease: 'linear' });
    let next = null;
    const body = { setNextKinematicTranslation(t) { next = t; }, setNextKinematicRotation() {} };
    scope.addAnimated({ body, entity: 'e', halfExtents: c.body.halfExtents, poseAt: c.poseAt });
    scope.tick({}, 0.5);
    assert.ok(close(next.y, 2), 'quarter period → halfway up');
    scope.tick({}, 0.5, undefined, true);
    assert.ok(close(next.y, 2), 'paused (time stop) holds the pose');

    scope.addBody('b1');
    scope.addEntity('e1');
    scope.addMaterialInstance('m1');
    const removed = [];
    const host = {
        world: { removeRigidBody: (b) => removed.push(`body:${b}`) },
        scene: { remove: (e) => removed.push(`scene:${e}`) },
        engine: { destroyEntity: (e) => removed.push(`entity:${e}`), destroyMaterialInstance: (m) => removed.push(`mi:${m}`) },
    };
    scope.dispose(host);
    assert.deepEqual(removed, ['body:b1', 'scene:e1', 'entity:e1', 'mi:m1'], 'dispose frees bodies, entities and material instances');
    assert.equal(scope.size, 0);
    assert.equal(scope.time, 0);
    assert.equal(scope.animated.length, 0);
}

// ── End to end: a v2 map builds into the headless world and moves ───────────
{
    const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', 'quantum_core.json'), 'utf8'));
    const level = mapToRuntimeLevel(map, 'json');
    const game = await buildHeadlessLevel(level);
    const movers = map.zones.filter((z) => z.type === 'mover').length;
    assert.equal(game.zoneScope.animated.length, movers, 'every mover is animated by the scope');
    const body = game.zoneScope.animated[0].body;
    const before = { ...body.translation() };
    stepHeadless(game, 60);
    assert.ok(!vecClose(before, body.translation(), 1e-3), 'movers advance with simulated time');
    const bodiesBefore = game.world.bodies.len();
    const owned = game.zoneScope.bodies.length;
    assert.ok(owned > 0);
    game.zoneScope.dispose(game);
    assert.equal(game.world.bodies.len(), bodiesBefore - owned, 'dispose removes exactly the scope-owned bodies');
}

console.log(`✓ Primitives OK (${PRIMITIVE_TYPES.join(', ')})`);
