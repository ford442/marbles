// @ts-check
/** Keyboard, gamepad, aim, charge, dash, jump input. */

/** @returns {import('../../types/game-state.js').InputState} */
export function createInputState() {
    return {
        keys: {},
        gamepadState: {},
        currentMarbleIndex: 0,
        aimYaw: 0,
        pitchAngle: 0,
        chargePower: 0,
        charging: false,
        isAiming: false,
        jumpCharge: 0,
        isChargingJump: false,
        jumpCount: 0,
        hasDoubleJumped: false,
        maxJumps: 3,
        lastBoostTime: 0,
        boostCooldown: 3000,
        lastDashTime: 0,
        dashCooldown: 2000,
        lastAirDashTime: 0,
        airDashCooldown: 2000,
        isChargingAirDash: false,
        airDashChargeTime: 0,
        airDashStartAltitude: 0,
        airDashOldGravity: 1.0,
        isChargingDash: false,
        dashCharge: 0,
        maxDashCharge: 1.0,
        isChargingStomp: false,
        stompChargeTime: 0,
        stompStartAltitude: 0,
        stompOldGravity: 1.0,
        stompOldColor: null,
        stompReleaseTime: 0,
    };
}
