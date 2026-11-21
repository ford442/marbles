import { NetworkClient } from '../game/network/network-client.ts';
import { RemotePlayers } from '../game/network/remote-players.ts';
import { generateRoomCode } from '../game/network/protocol.js';
import { LEVELS, isDevLevelsEnabled } from '../levels/catalog.js';
import { tickRemoteAbilityFx, clearRemoteAbilityFx } from '../game/network/ability-sync.ts';
import { updateDesyncIndicator, resetDesyncIndicator } from '../game/network/desync-indicator.ts';
import { HostSim } from '../game/network/host-sim.ts';
import { ClientPrediction } from '../game/network/client-prediction.ts';
import type { AbilitySyncHost } from '../game/network/ability-sync.ts';
import type { ClientPredictionHost } from '../game/network/client-prediction.ts';
import type { DesyncHost } from '../game/network/desync-indicator.ts';
import type { HostSimHost } from '../game/network/host-sim.ts';
import type { NetworkClientHost } from '../game/network/network-client.ts';
import type { RoomPlayer } from '../game/network/protocol-types.ts';
import type { RemotePlayersHost } from '../game/network/remote-players.ts';
import type { LevelLoader } from '../game/systems/level-loader.ts';
import type { PhysicsBackendHost } from '../game/systems/physics-backend.ts';
import type { FrameState } from '../types/frame-host.ts';
import type { InitLevelMenu } from './level-menu.ts';

/**
 * Party Race services, created once by `initMultiplayerMenu()` during boot
 * (before any menu or level code reads them).
 */
export interface MultiplayerContext {
    remotePlayers: RemotePlayers;
    network: NetworkClient;
    hostSim: HostSim;
    clientPrediction: ClientPrediction;
}

/**
 * What `InitMultiplayerMenu` uses on the game, including what the network
 * services it constructs (and the ability-sync / desync helpers it calls)
 * need from the game it hands them.
 */
export type InitMultiplayerMenuHost =
    & MultiplayerContext
    & Pick<PhysicsBackendHost, 'multiplayerMode' | 'hostAuthorityMode'>
    & Pick<FrameState, 'currentLevel'>
    & Pick<LevelLoader, 'loadLevel'>
    & Pick<InitLevelMenu, 'hideLevelSelection'>
    & NetworkClientHost
    & RemotePlayersHost
    & HostSimHost
    & ClientPredictionHost
    & AbilitySyncHost
    & DesyncHost;

/** `<input>` / `<select>` by id (menus.html); null when absent or another element. */
function inputById(id: string): HTMLInputElement | null {
    const el = document.getElementById(id);
    return el instanceof HTMLInputElement ? el : null;
}

function selectById(id: string): HTMLSelectElement | null {
    const el = document.getElementById(id);
    return el instanceof HTMLSelectElement ? el : null;
}

/** Message of a rejected relay call (an `Error`, or anything with a string `message`). */
function errorMessage(e: unknown): string | undefined {
    if (typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string') return e.message;
    return undefined;
}

function hostAuthorityEnabledFromUrl(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('hostAuth') === '1' || params.has('hostAuth');
}

export class InitMultiplayerMenu {
    declare game: InitMultiplayerMenuHost;

    constructor(game: InitMultiplayerMenuHost) {
        this.game = game;
    }

    initMultiplayerMenu(): void {
        this.game.multiplayerMode = false;
        this.game.hostAuthorityMode = false;
        this.game.remotePlayers = new RemotePlayers(this.game);
        this.game.network = new NetworkClient(this.game);
        this.game.hostSim = new HostSim(this.game);
        this.game.clientPrediction = new ClientPrediction(this.game);

        this.game.network.onRoomUpdate = (players) => this._renderLobbyPlayers(players);
        this.game.network.onStarting = (levelId, hostId, startAtMs, seed) => {
            this.game.multiplayerMode = true;
            this.game.hostAuthorityMode = hostAuthorityEnabledFromUrl();
            this._hideMultiplayerLobby(() => {
                this.game.hideLevelSelection(() => {
                    this.game.loadLevel(levelId, { startAtMs, seed }).then(() => {
                        if (this.game.hostAuthorityMode) {
                            this._initHostAuthority(hostId);
                        }
                    });
                });
            });
        };
        this.game.network.onDisconnected = () => {
            this._setLobbyStatus('Disconnected from relay.', true);
            if (this.game.multiplayerMode && this.game.currentLevel) {
                this._showMultiplayerDisconnectBanner();
            }
        };
        this.game.network.onError = (code, message) => {
            this._setLobbyStatus(`${code}: ${message}`, true);
        };

        const btnParty = document.getElementById('btn-party-race');
        if (btnParty) {
            btnParty.addEventListener('click', () => this.showMultiplayerLobby());
        }

        const btnCreate = document.getElementById('btn-create-room');
        const btnJoin = document.getElementById('btn-join-room');
        const btnStart = document.getElementById('btn-start-race');
        const btnLeave = document.getElementById('btn-leave-lobby');
        const btnClose = document.getElementById('btn-close-lobby');

        if (btnCreate) btnCreate.addEventListener('click', () => this._createRoom());
        if (btnJoin) btnJoin.addEventListener('click', () => this._joinRoom());
        if (btnStart) btnStart.addEventListener('click', () => this._startRace());
        if (btnLeave) btnLeave.addEventListener('click', () => this._leaveLobby());
        if (btnClose) btnClose.addEventListener('click', () => this._leaveLobby());
    }

    _initHostAuthority(hostId: string): void {
        if (this.game.network.isHost) {
            const spawn = this.game.currentLevel
                ? (LEVELS[this.game.currentLevel]?.spawn || { x: 0, y: 8, z: -12 })
                : { x: 0, y: 8, z: -12 };
            this.game.hostSim.init(this.game.network.players, spawn);
        } else {
            // A client that received START has joined, so it has a player id.
            const playerId = this.game.network.playerId;
            if (playerId !== null) this.game.clientPrediction.init(playerId);
        }
        void hostId;
    }

    showMultiplayerLobby(): void {
        const overlay = document.getElementById('multiplayer-lobby');
        if (!overlay) return;
        overlay.classList.add('active');
        this._setLobbyStatus('');

        const roomInput = inputById('mp-room-code');
        if (roomInput && !roomInput.value) {
            roomInput.value = generateRoomCode();
        }

        const levelSelect = selectById('mp-level-select');
        if (levelSelect && levelSelect.options.length === 0) {
            for (const [id, level] of Object.entries(LEVELS)) {
                if (level.source === 'code' && !isDevLevelsEnabled()) continue;
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = level.name;
                if (id === 'tutorial') opt.selected = true;
                levelSelect.appendChild(opt);
            }
        }

        this._renderLobbyPlayers(this.game.network.players);
    }

    _hideMultiplayerLobby(callback?: () => void): void {
        const overlay = document.getElementById('multiplayer-lobby');
        if (overlay) overlay.classList.remove('active');
        if (callback) callback();
    }

    _setLobbyStatus(message: string, isError = false): void {
        const el = document.getElementById('mp-lobby-status');
        if (!el) return;
        el.textContent = message;
        el.style.color = isError ? '#ff6b6b' : '#7fffd4';
    }

    async _createRoom(): Promise<void> {
        const name = this._getPlayerName();
        const roomInput = inputById('mp-room-code');
        const room = roomInput?.value?.trim().toUpperCase() || generateRoomCode();
        if (roomInput) roomInput.value = room;
        this._setLobbyStatus('Connecting…');

        try {
            await this.game.network.joinRoom(room, name);
            this._setLobbyStatus(`Room ${room} created. Share the code with friends.`);
            this._updateHostControls();
        } catch (e) {
            this._setLobbyStatus(errorMessage(e) || 'Could not connect to relay.', true);
        }
    }

    async _joinRoom(): Promise<void> {
        const name = this._getPlayerName();
        const roomInput = inputById('mp-room-code');
        const room = roomInput?.value?.trim().toUpperCase();
        if (!room) {
            this._setLobbyStatus('Enter a room code.', true);
            return;
        }

        this._setLobbyStatus('Joining…');
        try {
            await this.game.network.joinRoom(room, name);
            this._setLobbyStatus(`Joined room ${room}.`);
            this._updateHostControls();
        } catch (e) {
            this._setLobbyStatus(errorMessage(e) || 'Could not join room.', true);
        }
    }

    _startRace(): void {
        if (!this.game.network.isHost) return;
        const levelSelect = selectById('mp-level-select');
        const levelId = levelSelect?.value || 'tutorial';
        if (this.game.network.players.length < 2) {
            this._setLobbyStatus('Waiting for at least one more player…', true);
            return;
        }
        this.game.network.requestStart(levelId);
    }

    _leaveLobby(): void {
        this.game.network.disconnect();
        this.game.multiplayerMode = false;
        this.game.hostAuthorityMode = false;
        this.game.hostSim?.reset();
        this.game.clientPrediction?.reset();
        clearRemoteAbilityFx(this.game);
        resetDesyncIndicator(this.game);
        this._hideMultiplayerLobby();
        this._setLobbyStatus('');
    }

    _getPlayerName(): string {
        const input = inputById('mp-player-name');
        const name = input?.value?.trim();
        return name || `Marble-${Math.floor(Math.random() * 900 + 100)}`;
    }

    _updateHostControls(): void {
        const startBtn = document.getElementById('btn-start-race');
        const levelSelect = selectById('mp-level-select');
        const hostOnly = document.querySelectorAll<HTMLElement>('.mp-host-only');
        const isHost = this.game.network.isHost;

        if (startBtn) startBtn.style.display = isHost ? 'inline-block' : 'none';
        if (levelSelect) levelSelect.disabled = !isHost;
        hostOnly.forEach((el) => {
            el.style.display = isHost ? '' : 'none';
        });
    }

    _renderLobbyPlayers(players: readonly RoomPlayer[]): void {
        const list = document.getElementById('mp-player-list');
        if (!list) return;
        list.innerHTML = '';

        for (const player of players) {
            const li = document.createElement('li');
            li.textContent = `${player.name}${player.isHost ? ' (host)' : ''}`;
            list.appendChild(li);
        }

        this._updateHostControls();
    }

    _showMultiplayerDisconnectBanner(): void {
        const banner = document.getElementById('mp-disconnect-banner');
        if (banner) banner.classList.add('active');
    }

    tickMultiplayer(now = Date.now()): void {
        if (!this.game.multiplayerMode || !this.game.network?.room) return;

        if (this.game.hostAuthorityMode) {
            if (this.game.network.isHost) {
                this.game.hostSim?.tick(now);
            } else {
                this.game.clientPrediction?.recordInput(now);
                this.game.clientPrediction?.reconcileFromNetwork(now);
            }
            this.game.network.tickSendInput(now);
        } else {
            this.game.network.tickSendState(now);
            this.game.network.tickSendInput(now);
        }

        if (!this.game.network.playerId) return;
        this.game.remotePlayers.syncRoster(this.game.network.players, this.game.network.playerId);

        for (const player of this.game.network.players) {
            if (player.id === this.game.network.playerId) continue;
            const frame = this.game.network.getRemoteFrame(player.id, now);
            if (frame) {
                this.game.remotePlayers.updatePlayer(player.id, frame);
            }
        }

        tickRemoteAbilityFx(this.game, now);
        updateDesyncIndicator(this.game, now);
    }
}
