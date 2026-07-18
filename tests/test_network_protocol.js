import assert from 'node:assert/strict';
import {
    MSG,
    PROTOCOL_VERSION,
    MAX_MESSAGE_BYTES,
    generateRoomCode,
    hashRoomCode,
    parseJsonMessage,
    validateClientMessage,
    validateServerMessage,
    isSupportedProtocolVersion,
} from '../src/game/network/protocol.js';
import {
    encodeInputSnapshot,
    decodeMovementBits,
    decodeAbilityBits,
    decodeYaw,
    decodePitch,
    normalizeInputSnapshot,
} from '../src/game/network/input-bitfield.js';

function testRejectOversizedMessage() {
    const huge = 'x'.repeat(MAX_MESSAGE_BYTES + 1);
    const result = parseJsonMessage(huge);
    assert.equal(result.ok, false);
}

function testRejectInvalidJson() {
    assert.equal(parseJsonMessage('{not json').ok, false);
}

function testRejectEvalPayload() {
    const malicious = JSON.stringify({
        type: 'join',
        room: 'ABCD',
        name: '"; eval("hack");//',
        protocolVersion: PROTOCOL_VERSION,
    });
    const parsed = parseJsonMessage(malicious);
    assert.equal(parsed.ok, true);
    const validated = validateClientMessage(parsed.data);
    assert.equal(validated.ok, true);
    assert.equal(validated.data.name, '"; eval("hack");//'.slice(0, 24));
}

function testValidJoin() {
    const msg = { type: MSG.JOIN, room: 'ABC123', name: 'Racer', protocolVersion: PROTOCOL_VERSION };
    const validated = validateClientMessage(msg);
    assert.equal(validated.ok, true);
    assert.equal(validated.data.room, 'ABC123');
    assert.equal(validated.data.protocolVersion, PROTOCOL_VERSION);
}

function testRejectBadRoomCode() {
    const msg = { type: MSG.JOIN, room: 'ab!!', name: 'X', protocolVersion: PROTOCOL_VERSION };
    assert.equal(validateClientMessage(msg).ok, false);
}

function testRejectProtocolMismatch() {
    const msg = { type: MSG.JOIN, room: 'ABC123', name: 'Racer', protocolVersion: 1 };
    assert.equal(validateClientMessage(msg).ok, false);
    assert.equal(validateClientMessage({ type: MSG.JOIN, room: 'ABC123', name: 'Racer' }).ok, false);
    assert.equal(isSupportedProtocolVersion(1), false);
    assert.equal(isSupportedProtocolVersion(PROTOCOL_VERSION), true);
}

function testValidState() {
    const msg = {
        type: MSG.STATE,
        t: 1.5,
        x: 0, y: 1, z: 2,
        qx: 0, qy: 0, qz: 0, qw: 1,
        seq: 42,
    };
    assert.equal(validateClientMessage(msg).ok, true);
}

function testValidAbility() {
    const msg = {
        type: MSG.ABILITY,
        id: 'bomb',
        t: 2.5,
        seq: 1,
        ox: 0, oy: 1, oz: 2,
        dx: 0, dy: 1, dz: 0,
    };
    const validated = validateClientMessage(msg);
    assert.equal(validated.ok, true);
    assert.equal(validated.data.id, 'bomb');
}

function testRejectInvalidAbilityId() {
    const msg = {
        type: MSG.ABILITY,
        id: 'eval',
        t: 1,
        seq: 0,
        ox: 0, oy: 0, oz: 0,
        dx: 0, dy: 1, dz: 0,
    };
    assert.equal(validateClientMessage(msg).ok, false);
}

function testValidAbilityWithCharge() {
    const msg = {
        type: MSG.ABILITY,
        id: 'jump',
        t: 0.5,
        seq: 2,
        ox: 0, oy: 0, oz: 0,
        dx: 0, dy: 1, dz: 0,
        charge: 0.75,
    };
    assert.equal(validateClientMessage(msg).ok, true);
}

function testRejectBadAbilityCharge() {
    const msg = {
        type: MSG.ABILITY,
        id: 'jump',
        t: 0.5,
        seq: 2,
        ox: 0, oy: 0, oz: 0,
        dx: 0, dy: 1, dz: 0,
        charge: 1.5,
    };
    assert.equal(validateClientMessage(msg).ok, false);
}

function testValidInput() {
    const msg = {
        type: MSG.INPUT,
        t: 1.0,
        seq: 10,
        bits: 0x10001,
        yaw: 450,
        pitch: -120,
    };
    const validated = validateClientMessage(msg);
    assert.equal(validated.ok, true);
    assert.equal(validated.data.bits, 0x10001);
}

function testRejectInvalidInputBits() {
    assert.equal(validateClientMessage({
        type: MSG.INPUT,
        t: 1,
        seq: 0,
        bits: -1,
        yaw: 0,
        pitch: 0,
    }).ok, false);
}

function testRejectUnknownClientType() {
    assert.equal(validateClientMessage({ type: 'eval', code: '1+1' }).ok, false);
}

function testServerMessageWhitelist() {
    assert.equal(validateServerMessage({ type: MSG.JOINED, room: 'X' }).ok, true);
    assert.equal(validateServerMessage({ type: MSG.ABILITY, playerId: 'p1' }).ok, true);
    assert.equal(validateServerMessage({ type: MSG.INPUT, playerId: 'p1' }).ok, true);
    assert.equal(validateServerMessage({ type: 'exec' }).ok, false);
}

function testRoomCodeFormat() {
    const code = generateRoomCode();
    assert.match(code, /^[A-Z0-9]{6}$/);
}

function testHashRoomCodeDeterministic() {
    assert.equal(hashRoomCode('TEST12'), hashRoomCode('TEST12'));
    assert.notEqual(hashRoomCode('TEST12'), hashRoomCode('TEST13'));
}

function testInputBitfieldRoundTrip() {
    const game = {
        keys: { ArrowUp: true, KeyX: true, Space: true },
        charging: true,
        isChargingJump: false,
        isGrappling: false,
        aimYaw: Math.PI / 4,
        pitchAngle: -0.2,
        abilitySystem: {
            getKeyCode(id) {
                if (id === 'bomb') return 'KeyX';
                return undefined;
            },
        },
    };
    const encoded = encodeInputSnapshot(game);
    const normalized = normalizeInputSnapshot(encoded);
    assert.equal(normalized.bits, encoded.bits);
    assert.ok(decodeMovementBits(encoded.bits)[0]);
    assert.ok(decodeAbilityBits(encoded.bits).includes('bomb'));
    assert.ok(Math.abs(decodeYaw(encoded.yaw) - game.aimYaw) < 0.01);
    assert.ok(Math.abs(decodePitch(encoded.pitch) - game.pitchAngle) < 0.01);
}

function testNoEvalInProtocolPath() {
    const parsed = parseJsonMessage(JSON.stringify({
        type: MSG.JOIN,
        room: 'TEST12',
        name: 'SafeName',
        protocolVersion: PROTOCOL_VERSION,
    }));
    assert.equal(parsed.ok, true);
    const validated = validateClientMessage(parsed.data);
    assert.equal(validated.ok, true);
    assert.equal(validated.data.name, 'SafeName');
}

testRejectOversizedMessage();
testRejectInvalidJson();
testRejectEvalPayload();
testValidJoin();
testRejectBadRoomCode();
testRejectProtocolMismatch();
testValidState();
testValidAbility();
testRejectInvalidAbilityId();
testValidAbilityWithCharge();
testRejectBadAbilityCharge();
testValidInput();
testRejectInvalidInputBits();
testRejectUnknownClientType();
testServerMessageWhitelist();
testRoomCodeFormat();
testHashRoomCodeDeterministic();
testInputBitfieldRoundTrip();
testNoEvalInProtocolPath();

console.log('All network protocol tests passed.');
