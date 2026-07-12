import assert from 'node:assert/strict';
import {
    REPLAY_HZ,
    REPLAY_PREFIX,
    decodeReplayBinary,
    decodeReplayString,
    encodeReplayBinary,
    encodeReplayString,
    interpolateFrames,
    sampleReplayAtTime,
} from '../src/game/systems/replay-codec.js';

function makeFrames(count, startX = 0) {
    const frames = [];
    for (let i = 0; i < count; i++) {
        const qy = Math.sin(i * 0.1) * 0.3;
        const qw = Math.cos(i * 0.1);
        const qLen = Math.hypot(qy, qw) || 1;
        frames.push({
            t: i / REPLAY_HZ,
            x: startX + i * 0.1,
            y: Math.sin(i * 0.2) * 2,
            z: -i * 0.05,
            qx: 0,
            qy: qy / qLen,
            qz: 0,
            qw: qw / qLen,
        });
    }
    return frames;
}

function testRoundTripBinary() {
    const frames = makeFrames(90);
    const bytes = encodeReplayBinary(frames, 'tutorial');
    const decoded = decodeReplayBinary(bytes);

    assert.equal(decoded.levelId, 'tutorial');
    assert.equal(decoded.frames.length, frames.length);

    for (let i = 0; i < frames.length; i++) {
        const a = frames[i];
        const b = decoded.frames[i];
        assert.ok(Math.abs(a.x - b.x) < 0.01, `x mismatch at ${i}`);
        assert.ok(Math.abs(a.y - b.y) < 0.01, `y mismatch at ${i}`);
        assert.ok(Math.abs(a.z - b.z) < 0.01, `z mismatch at ${i}`);
        const quatDot = a.qx * b.qx + a.qy * b.qy + a.qz * b.qz + a.qw * b.qw;
        assert.ok(Math.abs(Math.abs(quatDot) - 1) < 0.02, `quat mismatch at ${i}`);
    }
}

function testRoundTripString() {
    const frames = makeFrames(60);
    const share = encodeReplayString(frames, 'tutorial');
    assert.ok(share.startsWith(REPLAY_PREFIX));

    const decoded = decodeReplayString(share);
    assert.equal(decoded.levelId, 'tutorial');
    assert.equal(decoded.frames.length, 60);
    assert.ok(Math.abs(decoded.frames[30].x - frames[30].x) < 0.02);
}

function testInterpolation() {
    const a = { t: 0, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    const b = { t: 1, x: 10, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    const mid = interpolateFrames(a, b, 0.5);
    assert.ok(Math.abs(mid.x - 5) < 0.001);
    assert.ok(Math.abs(mid.t - 0.5) < 0.001);
}

function testSampleAtTime() {
    const frames = makeFrames(120);
    const atTwo = sampleReplayAtTime(frames, 2.0);
    assert.ok(atTwo);
    assert.ok(Math.abs(atTwo.t - 2.0) < 0.05);
}

function testLargeTeleportDelta() {
    const frames = [
        { t: 0, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        { t: 1 / REPLAY_HZ, x: 50, y: 10, z: -20, qx: 0, qy: 0.7071068, qz: 0, qw: 0.7071068 },
    ];
    const share = encodeReplayString(frames, 'tutorial');
    const decoded = decodeReplayString(share);
    assert.ok(Math.abs(decoded.frames[1].x - 50) < 0.05);
    assert.ok(Math.abs(decoded.frames[1].y - 10) < 0.05);
}

testRoundTripBinary();
testRoundTripString();
testInterpolation();
testSampleAtTime();
testLargeTeleportDelta();

console.log('All replay codec tests passed.');
