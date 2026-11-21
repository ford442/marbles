/**
 * Editor camera: top-down placement view + free-orbit preview.
 */
import type { MapVec3 } from '../types/map.ts';
import type { EngineContext } from '../types/engine-context.ts';

export type EditorCameraMode = 'topdown' | 'orbit';

/** The Filament camera the editor points. */
export type EditorCameraHost = Pick<EngineContext, 'camera'>;

export class EditorCamera {
    declare game: EditorCameraHost;
    declare mode: EditorCameraMode;
    declare target: MapVec3;
    declare zoom: number;
    declare orbitYaw: number;
    declare orbitPitch: number;
    declare orbitRadius: number;
    declare _dragging: boolean;
    declare _lastX: number;
    declare _lastY: number;

    constructor(game: EditorCameraHost) {
        this.game = game;
        this.mode = 'topdown';
        this.target = { x: 0, y: 0, z: 0 };
        this.zoom = 45;
        this.orbitYaw = 0.6;
        this.orbitPitch = 0.55;
        this.orbitRadius = 55;
        this._dragging = false;
        this._lastX = 0;
        this._lastY = 0;
    }

    setMode(mode: EditorCameraMode): void {
        this.mode = mode;
    }

    toggleMode(): void {
        this.mode = this.mode === 'topdown' ? 'orbit' : 'topdown';
    }

    onMouseDown(e: MouseEvent, _canvas: HTMLCanvasElement): void {
        if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
            e.preventDefault();
            this._dragging = true;
            this._lastX = e.clientX;
            this._lastY = e.clientY;
        }
    }

    onMouseMove(e: MouseEvent): void {
        if (!this._dragging) return;
        const dx = e.clientX - this._lastX;
        const dy = e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;

        if (this.mode === 'topdown') {
            const pan = this.zoom * 0.004;
            this.target.x -= dx * pan;
            this.target.z -= dy * pan;
        } else {
            this.orbitYaw -= dx * 0.005;
            this.orbitPitch = Math.max(0.15, Math.min(1.4, this.orbitPitch - dy * 0.005));
        }
    }

    onMouseUp(): void {
        this._dragging = false;
    }

    onWheel(e: WheelEvent): void {
        e.preventDefault();
        if (this.mode === 'topdown') {
            this.zoom = Math.max(12, Math.min(120, this.zoom + e.deltaY * 0.05));
        } else {
            this.orbitRadius = Math.max(15, Math.min(150, this.orbitRadius + e.deltaY * 0.08));
        }
    }

    apply(): void {
        const camera = this.game.camera;
        if (!camera) return;

        if (this.mode === 'topdown') {
            const eye = [this.target.x, this.zoom, this.target.z + 0.01];
            const center = [this.target.x, 0, this.target.z];
            camera.lookAt(eye, center, [0, 0, -1]);
            return;
        }

        const cp = Math.cos(this.orbitPitch);
        const sp = Math.sin(this.orbitPitch);
        const cy = Math.cos(this.orbitYaw);
        const sy = Math.sin(this.orbitYaw);
        const eye = [
            this.target.x + sy * cp * this.orbitRadius,
            this.target.y + sp * this.orbitRadius,
            this.target.z + cy * cp * this.orbitRadius,
        ];
        camera.lookAt(eye, [this.target.x, this.target.y, this.target.z], [0, 1, 0]);
    }

    /**
     * Convert a canvas click to a world position on the XZ plane (y = planeY).
     */
    screenToWorld(clientX: number, clientY: number, canvas: HTMLCanvasElement, planeY = 0): MapVec3 {
        const rect = canvas.getBoundingClientRect();
        const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);

        if (this.mode === 'topdown') {
            const halfW = this.zoom * (rect.width / Math.max(rect.height, 1)) * 0.5;
            const halfH = this.zoom * 0.5;
            return {
                x: this.target.x + nx * halfW,
                y: planeY,
                z: this.target.z + ny * halfH,
            };
        }

        // Orbit: approximate ground pick along view frustum center ray
        const yaw = this.orbitYaw + nx * 0.35;
        const pitch = this.orbitPitch + ny * 0.2;
        const dirX = Math.sin(yaw) * Math.cos(pitch);
        const dirY = -Math.sin(pitch);
        const dirZ = Math.cos(yaw) * Math.cos(pitch);
        const eyeY = this.target.y + Math.sin(this.orbitPitch) * this.orbitRadius;
        const t = dirY < -0.01 ? (planeY - eyeY) / dirY : 20;
        return {
            x: this.target.x + dirX * t,
            y: planeY,
            z: this.target.z + dirZ * t,
        };
    }
}

export default EditorCamera;
