/** Keyboard, gamepad, aim, charge, dash, jump input. */
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
        maxJumps: 3,
        lastBoostTime: 0,
        boostCooldown: 3000,
        lastDashTime: 0,
        dashCooldown: 2000,
        isChargingDash: false,
        dashCharge: 0,
        maxDashCharge: 1.0,
    };
}
