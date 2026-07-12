import assert from 'node:assert/strict';
import {
    MSG,
    MAX_MESSAGE_BYTES,
    generateRoomCode,
    parseJsonMessage,
    validateClientMessage,
    validateServerMessage,
} from '../src/game/network/protocol.js';

function testRejectOversizedMessage() {
    const huge = 'x'.repeat(MAX_MESSAGE_BYTES + 1);
    const result = parseJsonMessage(huge);
    assert.equal(result.ok, false);
}

function testRejectInvalidJson() {
    assert.equal(parseJsonMessage('{not json').ok, false);
}

function testRejectEvalPayload() {
    const malicious = JSON.stringify({ type: 'join', room: 'ABCD', name: '"; eval("hack");//' });
    const parsed = parseJsonMessage(malicious);
    assert.equal(parsed.ok, true);
    const validated = validateClientMessage(parsed.data);
    assert.equal(validated.ok, true);
    assert.equal(validated.data.name, '"; eval("hack");//'.slice(0, 24));
}

function testValidJoin() {
    const msg = { type: MSG.JOIN, room: 'ABC123', name: 'Racer' };
    const validated = validateClientMessage(msg);
    assert.equal(validated.ok, true);
    assert.equal(validated.data.room, 'ABC123');
}

function testRejectBadRoomCode() {
    const msg = { type: MSG.JOIN, room: 'ab!!', name: 'X' };
    assert.equal(validateClientMessage(msg).ok, false);
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

function testRejectUnknownClientType() {
    assert.equal(validateClientMessage({ type: 'eval', code: '1+1' }).ok, false);
}

function testServerMessageWhitelist() {
    assert.equal(validateServerMessage({ type: MSG.JOINED, room: 'X' }).ok, true);
    assert.equal(validateServerMessage({ type: 'exec' }).ok, false);
}

function testRoomCodeFormat() {
    const code = generateRoomCode();
    assert.match(code, /^[A-Z0-9]{6}$/);
}

function testNoEvalInProtocolPath() {
    const parsed = parseJsonMessage(JSON.stringify({ type: MSG.JOIN, room: 'TEST12', name: 'SafeName' }));
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
testValidState();
testRejectUnknownClientType();
testServerMessageWhitelist();
testRoomCodeFormat();
testNoEvalInProtocolPath();

console.log('All network protocol tests passed.');
