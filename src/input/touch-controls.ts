import { detectPlatformProfile } from '../rendering-defaults.js';
import type { CameraState, InputState } from '../types/game-state.ts';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { TouchSettings } from '../types/settings.ts';

/** What the touch controls read and steer on the game. */
export type TouchControlsHost =
    & Pick<InputState, 'keys' | 'aimYaw' | 'pitchAngle'>
    & Pick<CameraState, 'cameraMode' | 'followDist' | 'targetCamRadius' | 'targetCamAngle' | 'targetCamHeight'>
    & Pick<InputSystemHost, 'isPaused'>;

interface TouchElements {
    root?: HTMLElement | null;
    joystick?: HTMLElement | null;
    knob?: HTMLElement | null;
    cameraZone?: HTMLElement | null;
    jump?: HTMLElement | null;
    boost?: HTMLElement | null;
    landscapeHint?: HTMLElement | null;
}

/** Joystick input arrives as touch events and (mouse / pen) pointer events. */
type JoystickEvent = TouchEvent | PointerEvent;

/** First changed touch of a touch event, else the (pointer) event itself. */
function primaryPoint(e: JoystickEvent): Touch | JoystickEvent {
    return ('changedTouches' in e ? e.changedTouches[0] : undefined) || e;
}

/** `Touch.identifier`; pointer events (and touch events with no changed touch) have none. */
function touchIdentifier(t: Touch | JoystickEvent): number | undefined {
    return 'identifier' in t ? t.identifier : undefined;
}

const DEFAULT_TOUCH: TouchSettings = {
    enabled: 'auto',
    joystickSide: 'left',
    jumpSlot: 'primary',
    boostSlot: 'secondary',
    cameraSensitivity: 50,
    invertCameraY: false,
    showControls: true,
};

/**
 * Virtual joystick + action buttons + touch camera for mobile play.
 */
export class TouchControls {
    declare game: TouchControlsHost;
    declare config: TouchSettings;
    declare active: boolean;
    declare joystick: { x: number; y: number; pointerId: number | null; originX: number; originY: number };
    declare camera: { pointerId: number | null; lastX: number; lastY: number };
    declare pinch: { active: boolean; startDist: number; startZoom: number };
    declare _heldButtons: Set<string>;
    declare _elements: TouchElements;

    constructor(game: TouchControlsHost) {
        this.game = game;
        this.config = { ...DEFAULT_TOUCH };
        this.active = false;
        this.joystick = { x: 0, y: 0, pointerId: null, originX: 0, originY: 0 };
        this.camera = { pointerId: null, lastX: 0, lastY: 0 };
        this.pinch = { active: false, startDist: 0, startZoom: 0 };
        this._heldButtons = new Set();
        this._elements = {};
    }

    applyConfig(touchSettings: Partial<TouchSettings> = {}): void {
        this.config = { ...DEFAULT_TOUCH, ...touchSettings };
        this._syncLayout();
        this._updateVisibility();
    }

    init(): void {
        this._elements.root = document.getElementById('touch-controls');
        this._elements.joystick = document.getElementById('touch-joystick');
        this._elements.knob = document.getElementById('touch-joystick-knob');
        this._elements.cameraZone = document.getElementById('touch-camera-zone');
        this._elements.jump = document.getElementById('touch-btn-jump');
        this._elements.boost = document.getElementById('touch-btn-boost');
        this._elements.landscapeHint = document.getElementById('landscape-hint');

        if (!this._elements.root) return;

        this._bindJoystick();
        this._bindCameraZone();
        this._bindActionButton(this._elements.jump, 'Space');
        this._bindActionButton(this._elements.boost, 'ShiftLeft');
        this._syncLayout();
        this._updateVisibility();

        window.addEventListener('orientationchange', () => this._updateLandscapeHint());
        window.addEventListener('resize', () => this._updateLandscapeHint());
    }

    shouldBeActive(): boolean {
        const mode = this.config.enabled || 'auto';
        if (mode === 'off') return false;
        if (mode === 'on') return true;
        return detectPlatformProfile().isMobile || 'ontouchstart' in window;
    }

    setGameplayActive(inLevel: boolean): void {
        this.active = inLevel && this.shouldBeActive();
        this._updateVisibility();
        this._updateLandscapeHint();
        if (!this.active) {
            this._releaseAll();
        }
    }

    /** Call each frame while playing to apply joystick → movement keys. */
    tick(): void {
        if (!this.active) return;

        const deadzone = 0.22;
        const { x, y } = this.joystick;
        const game = this.game;

        game.keys['ArrowUp'] = y < -deadzone;
        game.keys['ArrowDown'] = y > deadzone;
        game.keys['ArrowLeft'] = x < -deadzone;
        game.keys['ArrowRight'] = x > deadzone;
        game.keys['KeyW'] = game.keys['ArrowUp'];
        game.keys['KeyS'] = game.keys['ArrowDown'];
        game.keys['KeyA'] = game.keys['ArrowLeft'];
        game.keys['KeyD'] = game.keys['ArrowRight'];
    }

    _syncLayout(): void {
        const root = this._elements.root;
        if (!root) return;
        root.classList.toggle('touch-side-right', this.config.joystickSide === 'right');

        const jump = this._elements.jump;
        const boost = this._elements.boost;
        if (!jump || !boost) return;

        const jumpPrimary = this.config.jumpSlot !== 'secondary';
        jump.classList.toggle('touch-btn-primary', jumpPrimary);
        jump.classList.toggle('touch-btn-secondary', !jumpPrimary);
        boost.classList.toggle('touch-btn-primary', !jumpPrimary);
        boost.classList.toggle('touch-btn-secondary', jumpPrimary);
    }

    _updateVisibility(): void {
        const root = this._elements.root;
        if (!root) return;
        const show = this.active && this.config.showControls !== false;
        root.classList.toggle('hidden', !show);
    }

    _updateLandscapeHint(): void {
        const hint = this._elements.landscapeHint;
        if (!hint) return;
        const portrait = window.innerHeight > window.innerWidth;
        const show = this.active && portrait && detectPlatformProfile().isMobile;
        hint.classList.toggle('active', show);
    }

    _bindJoystick(): void {
        const base = this._elements.joystick;
        if (!base) return;
        const maxRadius = 52;

        const onStart = (e: JoystickEvent) => {
            if (!this.active || this.game.isPaused) return;
            e.preventDefault();
            const t = primaryPoint(e);
            this.joystick.pointerId = touchIdentifier(t) ?? 0;
            const rect = base.getBoundingClientRect();
            this.joystick.originX = rect.left + rect.width / 2;
            this.joystick.originY = rect.top + rect.height / 2;
            // A touchstart always carries a changed touch; only that or a pointer event has a position.
            if (!('clientX' in t)) return;
            this._moveJoystick(t.clientX, t.clientY, maxRadius);
        };

        const onMove = (e: JoystickEvent) => {
            if (this.joystick.pointerId === null) return;
            const changed = 'changedTouches' in e ? [...e.changedTouches] : [];
            const t = changed.find((touch) => touch.identifier === this.joystick.pointerId)
                || ('pointerId' in e && e.pointerId === this.joystick.pointerId ? e : null);
            if (!t) return;
            e.preventDefault();
            this._moveJoystick(t.clientX, t.clientY, maxRadius);
        };

        const onEnd = (e: JoystickEvent) => {
            const t = primaryPoint(e);
            const pointerId = 'pointerId' in e ? e.pointerId : undefined;
            if (touchIdentifier(t) !== this.joystick.pointerId && pointerId !== this.joystick.pointerId) return;
            this.joystick.pointerId = null;
            this.joystick.x = 0;
            this.joystick.y = 0;
            if (this._elements.knob) {
                this._elements.knob.style.transform = 'translate(-50%, -50%)';
            }
        };

        base.addEventListener('touchstart', onStart, { passive: false });
        base.addEventListener('touchmove', onMove, { passive: false });
        base.addEventListener('touchend', onEnd);
        base.addEventListener('touchcancel', onEnd);
        base.addEventListener('pointerdown', onStart);
        base.addEventListener('pointermove', onMove);
        base.addEventListener('pointerup', onEnd);
        base.addEventListener('pointercancel', onEnd);
    }

    _moveJoystick(clientX: number, clientY: number, maxRadius: number): void {
        let dx = clientX - this.joystick.originX;
        let dy = clientY - this.joystick.originY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }
        this.joystick.x = dx / maxRadius;
        this.joystick.y = dy / maxRadius;
        if (this._elements.knob) {
            this._elements.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
    }

    _bindCameraZone(): void {
        const zone = this._elements.cameraZone;
        if (!zone) return;

        const sensitivity = () => (this.config.cameraSensitivity || 50) / 2500;
        const ySign = () => (this.config.invertCameraY ? 1 : -1);

        zone.addEventListener('touchstart', (e) => {
            if (!this.active || this.game.isPaused) return;
            const [a, b] = [e.touches[0], e.touches[1]];
            if (e.touches.length === 2 && a && b) {
                this.pinch.active = true;
                this.pinch.startDist = this._touchDistance(a, b);
                this.pinch.startZoom = this.game.followDist || this.game.targetCamRadius || 20;
                return;
            }
            const t = e.changedTouches[0];
            if (!t) return;
            this.camera.pointerId = t.identifier;
            this.camera.lastX = t.clientX;
            this.camera.lastY = t.clientY;
        }, { passive: false });

        zone.addEventListener('touchmove', (e) => {
            if (!this.active || this.game.isPaused) return;
            e.preventDefault();

            const [a, b] = [e.touches[0], e.touches[1]];
            if (e.touches.length === 2 && this.pinch.active && a && b) {
                const dist = this._touchDistance(a, b);
                const scale = dist / (this.pinch.startDist || dist);
                const zoom = this.pinch.startZoom / scale;
                if (this.game.cameraMode === 'orbit') {
                    this.game.targetCamRadius = Math.max(5, Math.min(100, zoom));
                } else {
                    this.game.followDist = Math.max(5, Math.min(50, zoom));
                }
                return;
            }

            const t = [...e.changedTouches].find((touch) => touch.identifier === this.camera.pointerId);
            if (!t) return;
            const dx = t.clientX - this.camera.lastX;
            const dy = t.clientY - this.camera.lastY;
            this.camera.lastX = t.clientX;
            this.camera.lastY = t.clientY;

            this.game.aimYaw -= dx * sensitivity();
            this.game.pitchAngle += dy * sensitivity() * ySign();
            const maxPitch = 1.4;
            this.game.pitchAngle = Math.max(-maxPitch, Math.min(maxPitch, this.game.pitchAngle));

            if (this.game.cameraMode === 'orbit') {
                this.game.targetCamAngle -= dx * sensitivity() * 2;
                this.game.targetCamHeight += dy * sensitivity() * 10 * ySign();
                this.game.targetCamHeight = Math.max(1, Math.min(50, this.game.targetCamHeight));
            }
        }, { passive: false });

        const endCamera = (e: TouchEvent) => {
            const t = e.changedTouches?.[0];
            if (t && t.identifier === this.camera.pointerId) {
                this.camera.pointerId = null;
            }
            if (!e.touches?.length) {
                this.pinch.active = false;
            }
        };
        zone.addEventListener('touchend', endCamera);
        zone.addEventListener('touchcancel', endCamera);
    }

    _touchDistance(a: Touch, b: Touch): number {
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    _bindActionButton(el: HTMLElement | null | undefined, keyCode: string): void {
        if (!el) return;

        const down = (e: Event) => {
            if (!this.active || this.game.isPaused) return;
            e.preventDefault();
            e.stopPropagation();
            if (this._heldButtons.has(keyCode)) return;
            this._heldButtons.add(keyCode);
            window.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode, bubbles: true }));
        };

        const up = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this._heldButtons.has(keyCode)) return;
            this._heldButtons.delete(keyCode);
            window.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode, bubbles: true }));
        };

        el.addEventListener('touchstart', down, { passive: false });
        el.addEventListener('touchend', up);
        el.addEventListener('touchcancel', up);
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
    }

    _releaseAll(): void {
        for (const code of [...this._heldButtons]) {
            window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
        }
        this._heldButtons.clear();
        this.joystick.pointerId = null;
        this.joystick.x = 0;
        this.joystick.y = 0;
        this.camera.pointerId = null;
        this.pinch.active = false;
        if (this._elements.knob) {
            this._elements.knob.style.transform = 'translate(-50%, -50%)';
        }
    }
}

export default TouchControls;
