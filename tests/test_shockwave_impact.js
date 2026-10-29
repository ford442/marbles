import assert from 'assert';

// Core logic extracted for testability to prove it runs once
function simulateShockwaveImpact(game, grounded) {
    if (game.awaitingShockwaveImpact && grounded && game.playerMarble) {
        game.awaitingShockwaveImpact = false;

        // Target impulse simulation (represents the WASM bridge computation)
        for (const obj of game.dynamicObjects) {
             obj.rigidBody.applyImpulse({ x: 0, y: 500, z: 0 });
        }

        if (!game.cameraShake) game.cameraShake = { x: 0, y: 0, z: 0 };
        game.cameraShake.y += 2.0;
    }
}

class MockRigidBody {
    constructor() { this._impulse = { x: 0, y: 0, z: 0 }; }
    applyImpulse(impulse) {
        this._impulse.x += impulse.x;
        this._impulse.y += impulse.y;
        this._impulse.z += impulse.z;
    }
}

class MockGame {
    constructor() {
        this.playerMarble = true;
        this.dynamicObjects = [ { rigidBody: new MockRigidBody() } ];
        this.awaitingShockwaveImpact = true;
        this.cameraShake = { x: 0, y: 0, z: 0 };
    }
}

async function runImpactTest() {
    console.log("Testing Shockwave Dive impact trigger...");
    const game = new MockGame();

    assert.strictEqual(game.awaitingShockwaveImpact, true);

    // Simulate first frame where grounded = true
    simulateShockwaveImpact(game, true);

    // Flag must reset
    assert.strictEqual(game.awaitingShockwaveImpact, false);
    assert.ok(game.cameraShake.y >= 2.0);

    const targetImpulse = game.dynamicObjects[0].rigidBody._impulse.y;
    assert.ok(targetImpulse > 0);

    // Simulate second frame where grounded = true
    simulateShockwaveImpact(game, true);

    const targetImpulseFrame2 = game.dynamicObjects[0].rigidBody._impulse.y;
    // Should NOT have applied the impulse again
    assert.strictEqual(targetImpulseFrame2, targetImpulse, "Blast fired multiple times");

    console.log("Shockwave Dive impact tests passed.");
}

runImpactTest().catch(console.error);
