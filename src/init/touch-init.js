import { TouchControls } from '../input/touch-controls.js';

export class InitTouchControls {
    constructor(game) {
        this.game = game;
    }

    initTouchControls() {
        this.game.touchControls = new TouchControls(this.game);
        this.game.touchControls.init();
        if (this.game.settings?.controls?.touch) {
            this.game.touchControls.applyConfig(this.game.settings.controls.touch);
        }
    }

    applyTouchSettings() {
        if (this.game.touchControls && this.game.settings?.controls?.touch) {
            this.game.touchControls.applyConfig(this.game.settings.controls.touch);
        }
    }
}
