import { TouchControls, type TouchControlsHost } from '../input/touch-controls.ts';
import type { SettingsContext } from '../types/settings.ts';

/** The game's touch-controls instance (created by `initTouchControls()` at boot). */
export interface TouchControlsContext {
    touchControls?: TouchControls | null;
}

/** What `InitTouchControls` uses on the game (it also hands the game to `TouchControls`). */
export type InitTouchControlsHost =
    & TouchControlsContext
    & Pick<SettingsContext, 'settings'>
    & TouchControlsHost;

export class InitTouchControls {
    declare game: InitTouchControlsHost;

    constructor(game: InitTouchControlsHost) {
        this.game = game;
    }

    initTouchControls(): void {
        const touchControls = new TouchControls(this.game);
        this.game.touchControls = touchControls;
        touchControls.init();
        if (this.game.settings?.controls?.touch) {
            touchControls.applyConfig(this.game.settings.controls.touch);
        }
    }

    applyTouchSettings(): void {
        if (this.game.touchControls && this.game.settings?.controls?.touch) {
            this.game.touchControls.applyConfig(this.game.settings.controls.touch);
        }
    }
}
