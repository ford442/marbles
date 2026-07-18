import { audio } from '../audio.js';

export class GameLoopInput {
    handleInput(now, frameDeltaSec) {
        const rotSpeed = 0.02
        const zoomSpeed = 0.5

        if (this.keys['KeyR']) {
            this.respawnToLastCheckpoint()
            this.keys['KeyR'] = false // Debounce key press
        }
        if (this.keys['KeyM'] && this.currentLevel) {
            this.returnToMenu()
        }

        if (this.keys['BracketLeft']) {
            const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4
            audio.setVolume(currentVol - 0.1)
            this.keys['BracketLeft'] = false
        }
        if (this.keys['BracketRight']) {
            const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4
            audio.setVolume(currentVol + 0.1)
            this.keys['BracketRight'] = false
        }
        if (this.keys['KeyN']) {
            audio.init()
            const muted = audio.toggleMute()
            if (this.muteBtn) {
                this.muteBtn.textContent = muted ? '🔇' : '🔊'
                this.muteBtn.classList.toggle('muted', muted)
            }
            this.keys['KeyN'] = false
        }

        if (this.cameraMode === 'orbit') {
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.targetCamAngle -= rotSpeed
            if (this.keys['ArrowRight'] || this.keys['KeyD']) this.targetCamAngle += rotSpeed
            if (this.keys['ArrowUp'] || this.keys['KeyW']) this.targetCamRadius = Math.max(5, this.targetCamRadius - zoomSpeed)
            if (this.keys['ArrowDown'] || this.keys['KeyS']) this.targetCamRadius = Math.min(100, this.targetCamRadius + zoomSpeed)

            // Lerp actual values to targets for smooth movement
            this.camAngle += (this.targetCamAngle - this.camAngle) * 0.1
            this.camRadius += (this.targetCamRadius - this.camRadius) * 0.1
            this.camHeight += (this.targetCamHeight - this.camHeight) * 0.1
        } else if (this.cameraMode === 'follow' || this.cameraMode === 'action' || this.cameraMode === 'fpv' || this.cameraMode === 'topdown' || this.cameraMode === 'cinematic' || this.cameraMode === 'side-scroller' || this.cameraMode === 'drone') {
            let impulseStrength = 0.5
            if (this.activeEffects.speed && Date.now() < this.activeEffects.speed) {
                impulseStrength *= 2.0
            }

            if (this.playerMarble) {
                const rigidBody = this.playerMarble.rigidBody

                let forwardX = Math.sin(this.aimYaw)
                let forwardZ = Math.cos(this.aimYaw)
                let rightX = Math.sin(this.aimYaw - Math.PI / 2)
                let rightZ = Math.cos(this.aimYaw - Math.PI / 2)

                if (this.cameraMode === 'side-scroller') {
                    // Lock movement to the Z axis for left/right and X axis for up/down in side-scroller view
                    forwardX = -1; forwardZ = 0;
                    rightX = 0; rightZ = -1;
                }

                if (this.keys['ArrowUp'] || this.keys['KeyW']) rigidBody.applyImpulse({ x: forwardX * impulseStrength, y: 0, z: forwardZ * impulseStrength }, true)
                if (this.keys['ArrowDown'] || this.keys['KeyS']) rigidBody.applyImpulse({ x: -forwardX * impulseStrength, y: 0, z: -forwardZ * impulseStrength }, true)
                if (this.keys['ArrowLeft'] || this.keys['KeyA']) rigidBody.applyImpulse({ x: rightX * impulseStrength, y: 0, z: rightZ * impulseStrength }, true)
                if (this.keys['ArrowRight'] || this.keys['KeyD']) rigidBody.applyImpulse({ x: -rightX * impulseStrength, y: 0, z: -rightZ * impulseStrength }, true)
            }
        }

        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            if (this.playerMarble && now - this.lastBoostTime > this.boostCooldown) {
                const force = 60.0
                let boostYaw = this.aimYaw
                const dirX = Math.sin(boostYaw)
                const dirZ = Math.cos(boostYaw)

                this.playerMarble.rigidBody.applyImpulse({
                    x: dirX * force,
                    y: 0,
                    z: dirZ * force
                }, true)

                this.lastBoostTime = now
                audio.playBoost()

                if (this.hudManager) this.hudManager.markAbilityUsed('boost')
            }
        }
    }
}

export function applyGameLoopInput(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopInput.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopInput.prototype[name];
        }
    }
}
