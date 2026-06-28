/**
 * Batched decorative greeble helpers for zone authors.
 * All visuals are render-only — no Rapier colliders.
 */

function quatFromEulerYXZ(yaw, pitch, roll = 0) {
    const cy = Math.cos(yaw * 0.5)
    const sy = Math.sin(yaw * 0.5)
    const cp = Math.cos(pitch * 0.5)
    const sp = Math.sin(pitch * 0.5)
    const cr = Math.cos(roll * 0.5)
    const sr = Math.sin(roll * 0.5)
    return [
        sr * cp * cy - cr * sp * sy,
        cr * sp * cy + sr * cp * sy,
        cr * cp * sy - sr * sp * cy,
        cr * cp * cy + sr * sp * sy,
    ]
}

function instance(pos, rot, scale) {
    return {
        position: [pos.x, pos.y, pos.z],
        rotation: rot || [0, 0, 0, 1],
        scale: scale || [1, 1, 1],
    }
}

/** Space-station corridor girders, pipes, and solar-panel bumpers. */
export function decorateSpaceStation(game, offset) {
    if (!game.isStaticBatchingEnabled?.()) return

    const girders = []
    const pipes = []
    const bumpers = []

    for (let z of [offset.z + 8, offset.z + 28, offset.z + 48]) {
        girders.push(instance({ x: offset.x - 6.2, y: offset.y + 3.5, z }, [0, 0, 0, 1], [0.35, 0.35, 2.5]))
        girders.push(instance({ x: offset.x + 6.2, y: offset.y + 3.5, z }, [0, 0, 0, 1], [0.35, 0.35, 2.5]))
    }

    const hubZ = offset.z + 40
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2
        const cx = offset.x + Math.sin(angle) * 5
        const cz = hubZ + Math.cos(angle) * 5
        pipes.push(instance(
            { x: cx, y: offset.y + 1.8, z: cz },
            quatFromEulerYXZ(angle, Math.PI / 2, 0),
            [0.5, 0.5, 1.2]
        ))
    }

    bumpers.push(instance({ x: offset.x + 8, y: offset.y + 0.35, z: offset.z + 18 }, [0, 0, 0, 1], [1.2, 0.5, 1.2]))
    bumpers.push(instance({ x: offset.x - 8, y: offset.y + 0.35, z: offset.z + 18 }, [0, 0, 0, 1], [1.2, 0.5, 1.2]))
    for (let i = 0; i < 6; i++) {
        bumpers.push(instance(
            { x: offset.x + (Math.random() - 0.5) * 16, y: offset.y + 4 + Math.random() * 4, z: hubZ + 20 + i * 4 },
            quatFromEulerYXZ(Math.random() * Math.PI * 2, Math.random(), Math.random()),
            [0.4 + Math.random() * 0.4, 0.4 + Math.random() * 0.4, 0.4 + Math.random() * 0.4]
        ))
    }

    game.queueDecorativeBatch('girder', girders, [0.45, 0.48, 0.55], 'metal')
    game.queueDecorativeBatch('pipe', pipes, [0.35, 0.38, 0.42], 'metal')
    game.queueDecorativeBatch('bumper', bumpers, [0.55, 0.58, 0.65], 'metal')
}

/** Galaxy spiral crystals along the central pillar and platform edges. */
export function decorateGalaxySpiral(game, offset) {
    if (!game.isStaticBatchingEnabled?.()) return

    const crystals = []
    const spiralStartZ = offset.z + 15
    const pillarHeight = 30

    for (let y = 2; y < pillarHeight; y += 3) {
        const angle = y * 0.8
        crystals.push(instance(
            { x: offset.x + Math.sin(angle) * 1.6, y: offset.y + y, z: spiralStartZ + Math.cos(angle) * 1.6 },
            quatFromEulerYXZ(angle, 0.3, 0.5),
            [0.25, 0.7, 0.25]
        ))
    }

    const numSteps = 40
    const radius = 6
    for (let i = 0; i < numSteps; i += 4) {
        const angle = i * 0.3
        const px = offset.x + Math.sin(angle) * (radius + 0.6)
        const pz = spiralStartZ + Math.cos(angle) * (radius + 0.6)
        const py = offset.y + i * 0.75 + 0.5
        crystals.push(instance({ x: px, y: py, z: pz }, quatFromEulerYXZ(angle, -0.4, 0.2), [0.18, 0.55, 0.18]))
    }

    game.queueDecorativeBatch('crystal', crystals, [0.55, 0.25, 0.95], 'crystal')
}

/** Spiral-madness support girders + hazard stripes on the ascending track. */
export function decorateSpiralTrack(game, offset) {
    if (!game.isStaticBatchingEnabled?.()) return

    const girders = []
    const hazardStripes = []
    const numSteps = 60
    const radius = 10
    const heightGain = 0.3
    const angleStep = 0.2

    for (let i = 0; i < numSteps; i += 3) {
        const angle = i * angleStep
        const x = offset.x + Math.cos(angle) * (radius - 1.2)
        const z = offset.z + 10 + Math.sin(angle) * (radius - 1.2)
        const y = offset.y + i * heightGain - 0.6
        girders.push(instance(
            { x, y, z },
            quatFromEulerYXZ(-angle, 0, 0),
            [0.15, 0.15, 1.0]
        ))
    }

    for (let i = 5; i < numSteps; i += 10) {
        const angle = i * angleStep
        const x = offset.x + Math.cos(angle) * radius
        const z = offset.z + 10 + Math.sin(angle) * radius
        const y = offset.y + i * heightGain + 0.35
        hazardStripes.push(instance(
            { x, y, z },
            quatFromEulerYXZ(-angle, -0.2, 0),
            [1.2, 0.15, 0.8]
        ))
    }

    game.queueDecorativeBatch('girder', girders, [0.35, 0.28, 0.22], 'wood')
    game.queueDecorativeBatch('hazardStripe', hazardStripes, [0.95, 0.75, 0.1], 'metal')
}

/** Desert ruins — crystal shards and broken column capitals. */
export function decorateDesertRuins(game, offset) {
    if (!game.isStaticBatchingEnabled?.()) return

    const crystals = []
    const ruinsStartZ = offset.z + 10

    for (let i = 0; i < 6; i++) {
        const zPos = ruinsStartZ + 5 + i * 12
        const xPos = offset.x + (i % 2 === 0 ? -7.5 : 7.5)
        for (let j = 0; j < 3; j++) {
            crystals.push(instance(
                { x: xPos + (j - 1) * 0.5, y: offset.y + 1 + j * 0.8, z: zPos + (j - 1) * 0.4 },
                quatFromEulerYXZ(i * 0.7 + j, 0.2, 0.4),
                [0.3 + j * 0.15, 0.5 + j * 0.1, 0.25 + j * 0.05]
            ))
        }
    }

    game.queueDecorativeBatch('crystal', crystals, [0.75, 0.65, 0.45], 'sand')
}

/** Ice bridges — icicle crystals beneath narrow spans. */
export function decorateIceBridges(game, offset) {
    if (!game.isStaticBatchingEnabled?.()) return

    const crystals = []
    const bridgeStartZ = offset.z + 10
    const segmentCount = 6
    const segmentLength = 60 / segmentCount

    for (let i = 0; i < segmentCount; i += 2) {
        const zPos = bridgeStartZ + i * segmentLength
        for (let side of [-1, 1]) {
            for (let j = 0; j < 4; j++) {
                crystals.push(instance(
                    { x: offset.x + side * 1.8, y: offset.y - 0.5 - j * 0.35, z: zPos + j * 1.5 },
                    quatFromEulerYXZ(side * 0.3, 0, side * 0.2),
                    [0.12, 0.35 + j * 0.08, 0.12]
                ))
            }
        }
    }

    game.queueDecorativeBatch('crystal', crystals, [0.7, 0.92, 1.0], 'crystal')
}

/** Lava tubes — wall pipes and hazard stripes on platforms. */
export function decorateLavaTubes(game, offset) {
    if (!game.isStaticBatchingEnabled?.()) return

    const pipes = []
    const hazardStripes = []
    const tubeStartZ = offset.z + 10

    for (let i = 0; i < 4; i++) {
        const zPos = tubeStartZ + 5 + i * 15
        pipes.push(instance(
            { x: offset.x - 4.5, y: offset.y + 2.5, z: zPos },
            quatFromEulerYXZ(0, Math.PI / 2, 0),
            [0.35, 0.35, 3.5]
        ))
        pipes.push(instance(
            { x: offset.x + 4.5, y: offset.y + 2.5, z: zPos },
            quatFromEulerYXZ(0, Math.PI / 2, 0),
            [0.35, 0.35, 3.5]
        ))
        hazardStripes.push(instance(
            { x: offset.x, y: offset.y + 0.55, z: zPos },
            [0, 0, 0, 1],
            [2.5, 0.12, 0.6]
        ))
    }

    game.queueDecorativeBatch('pipe', pipes, [0.4, 0.35, 0.32], 'metal')
    game.queueDecorativeBatch('hazardStripe', hazardStripes, [1.0, 0.55, 0.05], 'metal')
}
