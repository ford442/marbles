import { NetworkClient } from '../game/network/network-client.js';
import { RemotePlayers } from '../game/network/remote-players.js';
import { generateRoomCode } from '../game/network/protocol.js';
import { LEVELS, isDevLevelsEnabled } from '../levels/catalog.js';
import { tickRemoteAbilityFx, clearRemoteAbilityFx } from '../game/network/ability-sync.js';
import { updateDesyncIndicator, resetDesyncIndicator } from '../game/network/desync-indicator.js';
import { HostSim } from '../game/network/host-sim.js';
import { ClientPrediction } from '../game/network/client-prediction.js';

function hostAuthorityEnabledFromUrl() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('hostAuth') === '1' || params.has('hostAuth');
}

export class InitMultiplayerMenu {
    constructor(game) {
        this.game = game;
    }

    initMultiplayerMenu() {
        this.game.multiplayerMode = false;
        this.game.hostAuthorityMode = false;
        this.game.remotePlayers = new RemotePlayers(this.game);
        this.game.network = new NetworkClient(this.game);
        this.game.hostSim = new HostSim(this.game);
        this.game.clientPrediction = new ClientPrediction(this.game);

        this.game.network.onRoomUpdate = (players) => this.game._renderLobbyPlayers(players);
        this.game.network.onStarting = (levelId, hostId, startAtMs, seed) => {
            this.game.multiplayerMode = true;
            this.game.hostAuthorityMode = hostAuthorityEnabledFromUrl();
            this.game._hideMultiplayerLobby(() => {
                this.game.hideLevelSelection(() => {
                    this.game.loadLevel(levelId, { startAtMs, seed }).then(() => {
                        if (this.game.hostAuthorityMode) {
                            this.game._initHostAuthority(hostId);
                        }
                    });
                });
            });
        };
        this.game.network.onDisconnected = () => {
            this.game._setLobbyStatus('Disconnected from relay.', true);
            if (this.game.multiplayerMode && this.game.currentLevel) {
                this.game._showMultiplayerDisconnectBanner();
            }
        };
        this.game.network.onError = (code, message) => {
            this.game._setLobbyStatus(`${code}: ${message}`, true);
        };

        const btnParty = document.getElementById('btn-party-race');
        if (btnParty) {
            btnParty.addEventListener('click', () => this.game.showMultiplayerLobby());
        }

        const btnCreate = document.getElementById('btn-create-room');
        const btnJoin = document.getElementById('btn-join-room');
        const btnStart = document.getElementById('btn-start-race');
        const btnLeave = document.getElementById('btn-leave-lobby');
        const btnClose = document.getElementById('btn-close-lobby');

        if (btnCreate) btnCreate.addEventListener('click', () => this.game._createRoom());
        if (btnJoin) btnJoin.addEventListener('click', () => this.game._joinRoom());
        if (btnStart) btnStart.addEventListener('click', () => this.game._startRace());
        if (btnLeave) btnLeave.addEventListener('click', () => this.game._leaveLobby());
        if (btnClose) btnClose.addEventListener('click', () => this.game._leaveLobby());
    }

    _initHostAuthority(hostId) {
        if (this.game.network.isHost) {
            const spawn = this.game.currentLevel
                ? (LEVELS[this.game.currentLevel]?.spawn || { x: 0, y: 8, z: -12 })
                : { x: 0, y: 8, z: -12 };
            this.game.hostSim.init(this.game.network.players, spawn);
        } else {
            this.game.clientPrediction.init(this.game.network.playerId);
        }
        void hostId;
    }

    showMultiplayerLobby() {
        const overlay = document.getElementById('multiplayer-lobby');
        if (!overlay) return;
        overlay.classList.add('active');
        this.game._setLobbyStatus('');

        const roomInput = document.getElementById('mp-room-code');
        if (roomInput && !roomInput.value) {
            roomInput.value = generateRoomCode();
        }

        const levelSelect = document.getElementById('mp-level-select');
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

        this.game._renderLobbyPlayers(this.game.network.players);
    }

    _hideMultiplayerLobby(callback) {
        const overlay = document.getElementById('multiplayer-lobby');
        if (overlay) overlay.classList.remove('active');
        if (callback) callback();
    }

    _setLobbyStatus(message, isError = false) {
        const el = document.getElementById('mp-lobby-status');
        if (!el) return;
        el.textContent = message;
        el.style.color = isError ? '#ff6b6b' : '#7fffd4';
    }

    async _createRoom() {
        const name = this.game._getPlayerName();
        const roomInput = document.getElementById('mp-room-code');
        const room = roomInput?.value?.trim().toUpperCase() || generateRoomCode();
        if (roomInput) roomInput.value = room;
        this.game._setLobbyStatus('Connecting…');

        try {
            await this.game.network.joinRoom(room, name);
            this.game._setLobbyStatus(`Room ${room} created. Share the code with friends.`);
            this.game._updateHostControls();
        } catch (e) {
            this.game._setLobbyStatus(e?.message || 'Could not connect to relay.', true);
        }
    }

    async _joinRoom() {
        const name = this.game._getPlayerName();
        const roomInput = document.getElementById('mp-room-code');
        const room = roomInput?.value?.trim().toUpperCase();
        if (!room) {
            this.game._setLobbyStatus('Enter a room code.', true);
            return;
        }

        this.game._setLobbyStatus('Joining…');
        try {
            await this.game.network.joinRoom(room, name);
            this.game._setLobbyStatus(`Joined room ${room}.`);
            this.game._updateHostControls();
        } catch (e) {
            this.game._setLobbyStatus(e?.message || 'Could not join room.', true);
        }
    }

    _startRace() {
        if (!this.game.network.isHost) return;
        const levelSelect = document.getElementById('mp-level-select');
        const levelId = levelSelect?.value || 'tutorial';
        if (this.game.network.players.length < 2) {
            this.game._setLobbyStatus('Waiting for at least one more player…', true);
            return;
        }
        this.game.network.requestStart(levelId);
    }

    _leaveLobby() {
        this.game.network.disconnect();
        this.game.multiplayerMode = false;
        this.game.hostAuthorityMode = false;
        this.game.hostSim?.reset();
        this.game.clientPrediction?.reset();
        clearRemoteAbilityFx(this.game);
        resetDesyncIndicator(this.game);
        this.game._hideMultiplayerLobby();
        this.game._setLobbyStatus('');
    }

    _getPlayerName() {
        const input = document.getElementById('mp-player-name');
        const name = input?.value?.trim();
        return name || `Marble-${Math.floor(Math.random() * 900 + 100)}`;
    }

    _updateHostControls() {
        const startBtn = document.getElementById('btn-start-race');
        const levelSelect = document.getElementById('mp-level-select');
        const hostOnly = document.querySelectorAll('.mp-host-only');
        const isHost = this.game.network.isHost;

        if (startBtn) startBtn.style.display = isHost ? 'inline-block' : 'none';
        if (levelSelect) levelSelect.disabled = !isHost;
        hostOnly.forEach((el) => {
            el.style.display = isHost ? '' : 'none';
        });
    }

    _renderLobbyPlayers(players) {
        const list = document.getElementById('mp-player-list');
        if (!list) return;
        list.innerHTML = '';

        for (const player of players) {
            const li = document.createElement('li');
            li.textContent = `${player.name}${player.isHost ? ' (host)' : ''}`;
            list.appendChild(li);
        }

        this.game._updateHostControls();
    }

    _showMultiplayerDisconnectBanner() {
        const banner = document.getElementById('mp-disconnect-banner');
        if (banner) banner.classList.add('active');
    }

    tickMultiplayer(now = Date.now()) {
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
