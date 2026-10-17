/**
 * Named-axis rotation helpers (src/math.ts) and the zone migration away from
 * the ambiguous quatFromEuler: Rz(a)·Ry(b)·Rx(c) must equal
 * quatMultiply(roll a, {yaw b, pitch c}) so migrated zones look identical.
 */
import assert from 'node:assert/strict';
import { quatFromEuler, quatFromYawPitchRoll, quatMultiply, quatRotateVec3 } from '../src/math.ts';

console.log('test_math_rotation.js');

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
function sameRotation(p, q) {
    const dot = p.x * q.x + p.y * q.y + p.z * q.z + p.w * q.w;
    return close(Math.abs(dot), 1, 1e-9);
}
function vecClose(v, w, eps = 1e-9) {
    return close(v.x, w.x, eps) && close(v.y, w.y, eps) && close(v.z, w.z, eps);
}

// Axis semantics in the Y-up world.
const yaw90 = quatFromYawPitchRoll({ yaw: Math.PI / 2 });
assert.ok(vecClose(quatRotateVec3(yaw90, { x: 0, y: 0, z: 1 }), { x: 1, y: 0, z: 0 }), 'yaw turns +Z toward +X');
const pitch = quatFromYawPitchRoll({ pitch: 0.3 });
const fwd = quatRotateVec3(pitch, { x: 0, y: 0, z: 1 });
assert.ok(fwd.y < 0 && close(fwd.x, 0), 'positive pitch lowers the +Z end (right-hand rule about +X)');
const roll = quatFromYawPitchRoll({ roll: 0.3 });
const right = quatRotateVec3(roll, { x: 1, y: 0, z: 0 });
assert.ok(right.y > 0 && close(right.z, 0), 'roll banks about +Z');

// Intrinsic yaw → pitch: a yawed ramp is pitched along its own length.
const yawPitch = quatFromYawPitchRoll({ yaw: Math.PI / 2, pitch: -0.2 });
const along = quatRotateVec3(yawPitch, { x: 0, y: 0, z: 1 });
assert.ok(along.x > 0.9 && along.y > 0, 'yaw 90° + negative pitch rises along +X');

// The legacy helper's real axes, and the exact migration identities.
for (let i = 0; i < 200; i++) {
    const a = (Math.random() - 0.5) * 6;
    const b = (Math.random() - 0.5) * 6;
    const c = (Math.random() - 0.5) * 6;
    const legacy = quatFromEuler(a, b, c);
    const migrated = quatMultiply(quatFromYawPitchRoll({ roll: a }), quatFromYawPitchRoll({ yaw: b, pitch: c }));
    assert.ok(sameRotation(legacy, migrated), `Rz·Ry·Rx identity (${a}, ${b}, ${c})`);
    assert.ok(sameRotation(quatFromEuler(a, 0, 0), quatFromYawPitchRoll({ roll: a })), 'first arg is Z');
    assert.ok(sameRotation(quatFromEuler(0, b, 0), quatFromYawPitchRoll({ yaw: b })), 'second arg is Y');
    assert.ok(sameRotation(quatFromEuler(0, 0, c), quatFromYawPitchRoll({ pitch: c })), 'third arg is X');
    assert.ok(sameRotation(quatFromEuler(0, b, c), quatFromYawPitchRoll({ yaw: b, pitch: c })), 'Ry·Rx identity');
}

console.log('✓ named-axis rotations and quatFromEuler migration identities');
