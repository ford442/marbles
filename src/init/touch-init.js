import { TouchControls } from '../input/touch-controls.js';

export class InitTouchControls {
    initTouchControls() {
        this.touchControls = new TouchControls(this);
        this.touchControls.init();
        if (this.settings?.controls?.touch) {
            this.touchControls.applyConfig(this.settings.controls.touch);
        }
    }

    applyTouchSettings() {
        if (this.touchControls && this.settings?.controls?.touch) {
            this.touchControls.applyConfig(this.settings.controls.touch);
        }
    }
}

export function applyInitTouchControls(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitTouchControls.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitTouchControls.prototype[name];
        }
    }
}
