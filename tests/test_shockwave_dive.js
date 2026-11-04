import assert from 'assert';
import { AbilityShockwaveDive } from '../src/abilities/shockwave-dive.js';

class MockRigidBody {
    constructor() {
        this._gravityScale = 1.0;
        this._impulse = { x: 0, y: 0, z: 0 };
        this._linvel = { x: 0, y: 0, z: 0 };
    }
    gravityScale() { return this._gravityScale; }
    setGravityScale(scale, wake) { this._gravityScale = scale; }
    linvel() { return this._linvel; }
    setLinvel(vel, wake) { this._linvel = vel; }
    applyImpulse(impulse, wake) {
        this._impulse.x += impulse.x;
        this._impulse.y += impulse.y;
        this._impulse.z += impulse.z;
    }
}

class MockGame extends AbilityShockwaveDive {
    constructor() {
        super();
        this.playerMarble = { rigidBody: new MockRigidBody() };
        this.hudManager = { markAbilityUsed: () => {} };
    }
}

async function runTests() {
    console.log("Testing Shockwave Dive logic...");
    const game = new MockGame();

    // Initial state
    assert.strictEqual(game.isChargingShockwave, undefined);
    assert.strictEqual(game.awaitingShockwaveImpact, undefined);

    // Charge starts
    const t0 = 1000;
    game.beginShockwaveCharge(t0);
    assert.strictEqual(game.isChargingShockwave, true);
    assert.strictEqual(game.shockwaveChargeTime, t0);
    assert.strictEqual(game.playerMarble.rigidBody.gravityScale(), 0.05);

    // Release triggers dive
    const t1 = 2000;
    game.releaseShockwave(t1);
    assert.strictEqual(game.isChargingShockwave, false);
    assert.strictEqual(game.awaitingShockwaveImpact, true);
    assert.strictEqual(game.playerMarble.rigidBody.gravityScale(), 1.0);

    // Check downward impulse was applied
    assert.ok(game.playerMarble.rigidBody._impulse.y < -100);

    // Ensure it can't be repeatedly triggered while awaiting impact
    // (In reality, logic.js manages grounding to reset awaitingShockwaveImpact)
    const t2 = 3000;
    const oldImpulse = game.playerMarble.rigidBody._impulse.y;
    game.releaseShockwave(t2);
    // Should not trigger again because isChargingShockwave is false
    assert.strictEqual(game.playerMarble.rigidBody._impulse.y, oldImpulse);

    console.log("Shockwave Dive logic tests passed.");
}

runTests().catch(console.error);
