import { NetworkClient } from '../game/network/network-client.js';
import { RemotePlayers } from '../game/network/remote-players.js';
import { generateRoomCode } from '../game/network/protocol.js';
import { LEVELS } from '../levels/catalog.js';

export class InitMultiplayerMenu {
    initMultiplayerMenu() {
        this.multiplayerMode = false;
        this.remotePlayers = new RemotePlayers(this);
        this.network = new NetworkClient(this);

        this.network.onRoomUpdate = (players) => this._renderLobbyPlayers(players);
        this.network.onStarting = (levelId) => {
            this.multiplayerMode = true;
            this._hideMultiplayerLobby(() => {
                this.hideLevelSelection(() => this.loadLevel(levelId));
            });
        };
        this.network.onDisconnected = () => {
            this._setLobbyStatus('Disconnected from relay.', true);
            if (this.multiplayerMode && this.currentLevel) {
                this._showMultiplayerDisconnectBanner();
            }
        };
        this.network.onError = (code, message) => {
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

    showMultiplayerLobby() {
        const overlay = document.getElementById('multiplayer-lobby');
        if (!overlay) return;
        overlay.classList.add('active');
        this._setLobbyStatus('');

        const roomInput = document.getElementById('mp-room-code');
        if (roomInput && !roomInput.value) {
            roomInput.value = generateRoomCode();
        }

        const levelSelect = document.getElementById('mp-level-select');
        if (levelSelect && levelSelect.options.length === 0) {
            for (const [id, level] of Object.entries(LEVELS)) {
                if (level.source === 'code' && !location.search.includes('devLevels=1')) continue;
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = level.name;
                if (id === 'tutorial') opt.selected = true;
                levelSelect.appendChild(opt);
            }
        }

        this._renderLobbyPlayers(this.network.players);
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
        const name = this._getPlayerName();
        const roomInput = document.getElementById('mp-room-code');
        const room = roomInput?.value?.trim().toUpperCase() || generateRoomCode();
        if (roomInput) roomInput.value = room;
        this._setLobbyStatus('Connecting…');

        try {
            await this.network.joinRoom(room, name);
            this._setLobbyStatus(`Room ${room} created. Share the code with friends.`);
            this._updateHostControls();
        } catch (e) {
            this._setLobbyStatus(e?.message || 'Could not connect to relay.', true);
        }
    }

    async _joinRoom() {
        const name = this._getPlayerName();
        const roomInput = document.getElementById('mp-room-code');
        const room = roomInput?.value?.trim().toUpperCase();
        if (!room) {
            this._setLobbyStatus('Enter a room code.', true);
            return;
        }

        this._setLobbyStatus('Joining…');
        try {
            await this.network.joinRoom(room, name);
            this._setLobbyStatus(`Joined room ${room}.`);
            this._updateHostControls();
        } catch (e) {
            this._setLobbyStatus(e?.message || 'Could not join room.', true);
        }
    }

    _startRace() {
        if (!this.network.isHost) return;
        const levelSelect = document.getElementById('mp-level-select');
        const levelId = levelSelect?.value || 'tutorial';
        if (this.network.players.length < 2) {
            this._setLobbyStatus('Waiting for at least one more player…', true);
            return;
        }
        this.network.requestStart(levelId);
    }

    _leaveLobby() {
        this.network.disconnect();
        this.multiplayerMode = false;
        this._hideMultiplayerLobby();
        this._setLobbyStatus('');
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
        const isHost = this.network.isHost;

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

        this._updateHostControls();
    }

    _showMultiplayerDisconnectBanner() {
        const banner = document.getElementById('mp-disconnect-banner');
        if (banner) banner.classList.add('active');
    }

    tickMultiplayer(now = Date.now()) {
        if (!this.multiplayerMode || !this.network?.room) return;

        this.network.tickSendState(now);

        if (!this.network.playerId) return;
        this.remotePlayers.syncRoster(this.network.players, this.network.playerId);

        for (const player of this.network.players) {
            if (player.id === this.network.playerId) continue;
            const frame = this.network.getRemoteFrame(player.id, now);
            if (frame) {
                this.remotePlayers.updatePlayer(player.id, frame);
            }
        }
    }
}

export function applyInitMultiplayerMenu(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitMultiplayerMenu.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitMultiplayerMenu.prototype[name];
        }
    }
}
