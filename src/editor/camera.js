/**
 * Editor camera: top-down placement view + free-orbit preview.
 */
export class EditorCamera {
    /** @param {object} game */
    constructor(game) {
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

    setMode(mode) {
        this.mode = mode;
    }

    toggleMode() {
        this.mode = this.mode === 'topdown' ? 'orbit' : 'topdown';
    }

    /**
     * @param {MouseEvent} e
     * @param {HTMLCanvasElement} canvas
     */
    onMouseDown(e, canvas) {
        if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
            e.preventDefault();
            this._dragging = true;
            this._lastX = e.clientX;
            this._lastY = e.clientY;
        }
    }

    /**
     * @param {MouseEvent} e
     */
    onMouseMove(e) {
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

    onMouseUp() {
        this._dragging = false;
    }

    /**
     * @param {WheelEvent} e
     */
    onWheel(e) {
        e.preventDefault();
        if (this.mode === 'topdown') {
            this.zoom = Math.max(12, Math.min(120, this.zoom + e.deltaY * 0.05));
        } else {
            this.orbitRadius = Math.max(15, Math.min(150, this.orbitRadius + e.deltaY * 0.08));
        }
    }

    apply() {
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
     * @param {number} clientX
     * @param {number} clientY
     * @param {HTMLCanvasElement} canvas
     * @param {number} [planeY]
     */
    screenToWorld(clientX, clientY, canvas, planeY = 0) {
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
