import { audio } from '../../audio.js';
import { quaternionToMat4 } from '../../math.js';
import { getMarblePhysics } from '../../wasm-bridge.js';

/**
 * @param {string} playerId
 * @param {number} seq
 * @param {number} [seed]
 * @returns {number}
 */
export function hashPlayerSeq(playerId, seq, seed = 0) {
    let hash = seed >>> 0;
    for (let i = 0; i < playerId.length; i++) {
        hash ^= playerId.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    hash ^= seq;
    hash = Math.imul(hash, 16777619);
    return hash >>> 0;
}

/**
 * @param {object} game
 * @param {string} id
 * @param {number} [charge]
 * @returns {object | null}
 */
export function buildAbilityPayload(game, id, charge) {
    if (!game.playerMarble?.rigidBody) return null;

    const pos = game.playerMarble.rigidBody.translation();
    const cosP = Math.cos(game.pitchAngle || 0);
    const sinP = Math.sin(game.pitchAngle || 0);
    let dirX = Math.sin(game.aimYaw || 0) * cosP;
    let dirY = sinP;
    let dirZ = Math.cos(game.aimYaw || 0) * cosP;

    if (id === 'jump' || id === 'bomb') {
        dirX = 0;
        dirY = 1;
        dirZ = 0;
    }

    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    const payload = {
        id,
        ox: pos.x,
        oy: pos.y,
        oz: pos.z,
        dx: dirX / len,
        dy: dirY / len,
        dz: dirZ / len,
    };

    if (charge !== undefined) {
        payload.charge = Math.max(0, Math.min(1, charge));
    }

    return payload;
}

/**
 * @param {object} game
 */
export function initRemoteAbilityFx(game) {
    if (!game.remoteAbilityFx) {
        game.remoteAbilityFx = [];
    }
}

/**
 * @param {object} game
 * @param {object} msg
 */
export function applyRemoteAbility(game, msg) {
    if (!msg?.id || msg.playerId === game.network?.playerId) return;
    initRemoteAbilityFx(game);

    const seed = game.network?.raceSeed ?? 0;
    const variance = hashPlayerSeq(msg.playerId, msg.seq, seed);
    const origin = { x: msg.ox, y: msg.oy, z: msg.oz };
    const dir = { x: msg.dx, y: msg.dy, z: msg.dz };

    switch (msg.id) {
        case 'bomb':
            spawnRemoteBomb(game, origin, variance);
            break;
        case 'missile':
            spawnRemoteMissile(game, origin, dir, variance);
            break;
        case 'blackhole':
            spawnRemoteBlackHole(game, origin, dir, variance);
            break;
        case 'holo':
            spawnRemoteHolo(game, origin, variance);
            break;
        case 'blink':
            spawnRemoteBlink(game, origin, dir, variance);
            break;
        case 'jump':
            spawnRemoteJump(game, origin, msg.charge ?? 0.5, variance);
            break;
        default:
            spawnRemoteGenericBurst(game, origin, variance);
            break;
    }
}

function spawnVisualBurst(game, pos, color, count = 8) {
    if (!game.particleSystem) return;
    game.particleSystem.emitParticles('spark', pos, count, {
        lifetime: 0.4,
        size: 0.15,
        color,
    });
}

function applyExplosionToLocalMarble(game, pos, radius, force) {
    if (!game.playerMarble?.rigidBody) return;
    const body = game.playerMarble.rigidBody;
    const t = body.translation();
    const dx = t.x - pos.x;
    const dy = t.y - pos.y;
    const dz = t.z - pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist >= radius || dist <= 0.1) return;

    const factor = 1.0 - dist / radius;
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;
    body.applyImpulse({
        x: nx * force * factor,
        y: (ny * 0.5 + 0.5) * force * factor,
        z: nz * force * factor,
    }, true);
}

function spawnRemoteBomb(game, origin, variance) {
    const slot = game.effectPool?.acquireProjectile('bomb', origin);
    if (!slot) return;

    const tcm = game.engine.getTransformManager();
    tcm.setTransform(tcm.getInstance(slot.entity), quaternionToMat4(origin, { x: 0, y: 0, z: 0, w: 1 }));

    game.remoteAbilityFx.push({
        kind: 'bomb',
        entity: slot.entity,
        matInstance: slot.matInstance,
        lightEntity: slot.lightEntity,
        _poolSlot: slot,
        pos: { ...origin },
        spawnTime: Date.now(),
        duration: 2500,
        exploded: false,
        variance,
    });

    if (audio.playAbility) audio.playAbility('bomb', origin);
}

function spawnRemoteMissile(game, origin, dir, variance) {
    const spawnPos = {
        x: origin.x + dir.x * 1.5,
        y: origin.y + dir.y * 1.5,
        z: origin.z + dir.z * 1.5,
    };
    const slot = game.effectPool?.acquireProjectile('missile', spawnPos);
    if (!slot) return;

    game.remoteAbilityFx.push({
        kind: 'missile',
        entity: slot.entity,
        matInstance: slot.matInstance,
        lightEntity: slot.lightEntity,
        _poolSlot: slot,
        pos: { ...spawnPos },
        dir: { ...dir },
        speed: 40,
        spawnTime: Date.now(),
        duration: 3000,
        exploded: false,
        variance,
    });

    if (audio.playAbility) audio.playAbility('missile', spawnPos);
}

function spawnRemoteBlackHole(game, origin, dir, variance) {
    const spawnPos = {
        x: origin.x + dir.x * 2,
        y: origin.y + dir.y * 2,
        z: origin.z + dir.z * 2,
    };
    const slot = game.effectPool?.acquireProjectile('blackHole', spawnPos);
    if (!slot) return;

    game.remoteAbilityFx.push({
        kind: 'blackhole',
        entity: slot.entity,
        matInstance: slot.matInstance,
        lightEntity: slot.lightEntity,
        _poolSlot: slot,
        pos: { ...spawnPos },
        dir: { ...dir },
        speed: 5,
        spawnTime: Date.now(),
        duration: 8000,
        variance,
    });

    if (typeof audio !== 'undefined' && audio.playTrick) audio.playTrick();
}

function spawnRemoteHolo(game, origin, variance) {
    const slot = game.effectPool?.acquireHoloPlatform();
    if (!slot) return;

    const spawnPos = { x: origin.x, y: origin.y - 1.2, z: origin.z };
    const halfExtents = slot.halfExtents || { x: 3, y: 0.2, z: 3 };

    const tcm = game.engine.getTransformManager();
    const mat = quaternionToMat4(spawnPos, { x: 0, y: 0, z: 0, w: 1 });
    mat[0] *= halfExtents.x * 2;
    mat[1] *= halfExtents.x * 2;
    mat[2] *= halfExtents.x * 2;
    mat[4] *= halfExtents.y * 2;
    mat[5] *= halfExtents.y * 2;
    mat[6] *= halfExtents.y * 2;
    mat[8] *= halfExtents.z * 2;
    mat[9] *= halfExtents.z * 2;
    mat[10] *= halfExtents.z * 2;
    tcm.setTransform(tcm.getInstance(slot.entity), mat);

    game.remoteAbilityFx.push({
        kind: 'holo',
        entity: slot.entity,
        matInstance: slot.matInstance,
        _poolSlot: slot,
        spawnTime: Date.now(),
        duration: 5000,
        variance,
    });
}

function spawnRemoteBlink(game, origin, dir, variance) {
    const dist = 6 + (variance % 400) / 100;
    const end = {
        x: origin.x + dir.x * dist,
        y: origin.y + dir.y * dist,
        z: origin.z + dir.z * dist,
    };
    spawnVisualBurst(game, origin, [1.0, 0.8, 0.0], 6);
    spawnVisualBurst(game, end, [1.0, 0.8, 0.0], 6);
    if (audio.playAbility) audio.playAbility('blink', end);
}

function spawnRemoteJump(game, origin, charge, variance) {
    const force = 5 + charge * 10;
    spawnVisualBurst(game, origin, [0.3, 0.8, 1.0], Math.round(4 + charge * 8));

    if (game.playerMarble?.rigidBody) {
        const gravityDir = game.playerMarble.rigidBody.gravityScale() < 0 ? -1 : 1;
        game.playerMarble.rigidBody.applyImpulse({ x: 0, y: force * gravityDir, z: 0 }, true);
    }

    if (audio.playJump) audio.playJump();
    void variance;
}

function spawnRemoteGenericBurst(game, origin, variance) {
    spawnVisualBurst(game, origin, [0.8, 0.5, 1.0], 4 + (variance % 4));
    void variance;
}

/**
 * @param {object} game
 * @param {number} now
 */
export function tickRemoteAbilityFx(game, now = Date.now()) {
    if (!game.remoteAbilityFx?.length) return;

    const tcm = game.engine?.getTransformManager();
    const physics = getMarblePhysics();

    for (let i = game.remoteAbilityFx.length - 1; i >= 0; i--) {
        const fx = game.remoteAbilityFx[i];
        const elapsed = now - fx.spawnTime;

        if (elapsed > fx.duration) {
            releaseRemoteFx(game, fx);
            game.remoteAbilityFx.splice(i, 1);
            continue;
        }

        if (fx.kind === 'missile' || fx.kind === 'blackhole') {
            fx.pos.x += fx.dir.x * fx.speed * 0.05;
            fx.pos.y += fx.dir.y * fx.speed * 0.05;
            fx.pos.z += fx.dir.z * fx.speed * 0.05;

            if (tcm && fx.entity) {
                tcm.setTransform(
                    tcm.getInstance(fx.entity),
                    quaternionToMat4(fx.pos, { x: 0, y: 0, z: 0, w: 1 })
                );
                if (fx.lightEntity) {
                    tcm.setTransform(
                        tcm.getInstance(fx.lightEntity),
                        quaternionToMat4(fx.pos, { x: 0, y: 0, z: 0, w: 1 })
                    );
                }
            }

            if (fx.kind === 'blackhole' && game.playerMarble?.rigidBody) {
                const pos = game.playerMarble.rigidBody.translation();
                const force = physics.computeForceField(
                    fx.pos.x, fx.pos.y, fx.pos.z,
                    pos.x, pos.y, pos.z,
                    20, 1, 0.5, 25
                );
                game.playerMarble.rigidBody.applyImpulse(force, true);
            }
        }

        if (fx.kind === 'bomb' && !fx.exploded && elapsed >= fx.duration - 50) {
            fx.exploded = true;
            applyExplosionToLocalMarble(game, fx.pos, 20, 120);
            spawnVisualBurst(game, fx.pos, [1.0, 0.4, 0.1], 12);
        }

        if (fx.kind === 'missile' && !fx.exploded && elapsed >= fx.duration - 50) {
            fx.exploded = true;
            applyExplosionToLocalMarble(game, fx.pos, 10, 80);
            spawnVisualBurst(game, fx.pos, [1.0, 0.5, 0.0], 10);
        }
    }
}

function releaseRemoteFx(game, fx) {
    if (fx._poolSlot && (fx.kind === 'bomb' || fx.kind === 'missile' || fx.kind === 'blackhole')) {
        game.effectPool?.releaseProjectile({
            entity: fx.entity,
            matInstance: fx.matInstance,
            lightEntity: fx.lightEntity,
            _poolSlot: fx._poolSlot,
        });
        return;
    }
    if (fx.kind === 'holo' && fx._poolSlot) {
        game.effectPool?.releaseHoloPlatform?.({
            _poolSlot: fx._poolSlot,
            entity: fx.entity,
            matInstance: fx.matInstance,
        });
        return;
    }
    game.scene?.remove(fx.entity);
}

/**
 * @param {object} game
 */
export function clearRemoteAbilityFx(game) {
    if (!game.remoteAbilityFx) return;
    for (const fx of game.remoteAbilityFx) {
        releaseRemoteFx(game, fx);
    }
    game.remoteAbilityFx = [];
}
