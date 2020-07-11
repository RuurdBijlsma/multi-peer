import Peer from 'simple-peer'
import EventEmitter from 'events';
import SignalModule from "multi-signal-server";

export default class MultiPeerBase extends EventEmitter {
    constructor(appName, buffered = false, trickle = true, wrtc = false) {
        super();
        this.wrtc = wrtc;
        this.appName = appName;
        this.trickle = trickle;
        this.peers = {};
        this.printDebug = false;
        this.room = '';
        this.peerType = 'base';

        this._tps = 60;
        this._sendQueue = [];
        this._bufferInterval = -1;
        if (buffered)
            this.enableBuffering(this._tps);

        this.signal = new SignalModule(appName);
    }

    enableBuffering(tps) {
        clearInterval(this._bufferInterval);
        this._sendBuffered = true;
        this._tps = tps;
        this._bufferInterval = setInterval(() => {
            let buffer = {};
            for (let [id, message] of this._sendQueue) {
                if (!buffer[id])
                    buffer[id] = [];
                buffer[id].push(message);
            }
            for (let id in buffer)
                this._realSend(id, JSON.stringify(buffer[id]));
            this._sendQueue = [];
        }, 1000 / tps);
    }

    disableBuffering(tps) {
        clearInterval(this._bufferInterval);
        this._sendBuffered = false;
    }

    sendToPeer(id, message, raw = false) {
        if (this._sendBuffered)
            this._sendQueue.push([id, message]);
        else
            this._realSend(id, message, raw)
    }

    _realSend(id, message, raw = false) {
        message = typeof message === 'string' || raw ? message : JSON.stringify(message);

        if (this.peers.hasOwnProperty(id) && this.peers[id] !== null)
            this.peers[id].send(message);
    }

    async getServerRooms(url) {
        if (url[url.length - 1] !== '/')
            url += '/';
        try {
            let response = await fetch(url + 'rooms');
            return (await response.json()).filter(room => room.appName === this.appName)
        } catch (e) {
            return null
        }
    }

    // On node/electron webSocketOnly might be necessary
    async connect(url, webSocketOnly = false) {
        await this.signal.connect(url, webSocketOnly);

        this.signal.on('room-count', roomCount => {
            this.emit('room-count', roomCount);
            this.checkFullConnect()
        });

        this.signal.on('socket-id', mySocketId => {
            this.emit('socket-id', mySocketId);
        });

        this.signal.on('destroy', socketId => {
            // Client will also get this event for every disconnecting client even though they are not connected to every other client ¯\_(ツ)_/¯
            if (this.peers.hasOwnProperty(socketId)) {
                try {
                    this.peers[socketId].destroy();
                } catch (e) {
                    //ignored, peer might already be destroyed error
                }
                delete this.peers[socketId];
                this.emit('disconnect', socketId);
                this.log('Destroying peer', socketId, 'peer count:', this.getConnectedPeerCount())
            }
        });

        this.signal.on('signal', (socketId, signal) => {
            this.log('Receiving signal from ', socketId);

            if (!this.peers.hasOwnProperty(socketId)) {
                this.log(`${socketId} is initializing with me`);
                this.peers[socketId] = this.createPeer(socketId, false)
            }

            this.log(`Signalling ${socketId}`, signal);
            this.peers[socketId].signal(signal)
        })
    }

    createPeer(socketId, initiator) {
        let options = {initiator, trickle: this.trickle};
        if (this.wrtc) {
            options.wrtc = this.wrtc;
            this.log('Using wrtc', options)
        }

        let peer = new Peer(options);
        peer.on('error', err => {
            console.warn(err);
            this.log('error', err);
            this.emit('error', peer, socketId, {peer, error: err, initiator});
        });

        peer.on('signal', data => {
            this.log(`Emitting signal to socket: ${socketId}`);
            this.signal.message(socketId, 'signal', data)
        });

        peer.on('connect', () => {
            let peerCount = this.getConnectedPeerCount();
            this.log('New peer connection, peer count: ', peerCount);
            this.emit('connect', socketId);
            this.checkFullConnect();
        });

        peer.on('data', data => {
            this.log('data: ' + data);
            if (this._sendBuffered) {
                let bufferedMessages = JSON.parse(data);
                bufferedMessages.forEach(m => this.emit('data', socketId, m));
            } else {
                let firstChar = String.fromCharCode(data[0]);
                if (firstChar === '[' || firstChar === '{') {
                    // Probably json :O
                    data = JSON.parse(data);
                }
                this.emit('data', socketId, data);
            }
        });

        peer.on('stream', stream => {
            this.log("Stream received!");
            this.emit('stream', socketId, stream);
            this.log('stream: ', stream)
        });

        peer.on('track', (track, stream) => {
            this.log('track: ', track, 'stream', stream);
            this.emit('track', track, socketId, stream);
        });

        peer.on('close', () => this.log('Peer connection closed', peer));

        return peer
    }

    isFullyConnected() {
        throw "Not implemented!";
    }

    getConnectedPeerCount() {
        return this.peerList.map(p => p.connected).reduce((a, b) => a + b, 0);
    }

    checkFullConnect() {
        if (this.isFullyConnected())
            this.emit('full-connect');
    }

    destroy() {
        this.signal.destroy();
        this.peerList.forEach(p => p.destroy());
        this.peers = {};
    }

    log(...msg) {
        if (this.printDebug) {
            console.log('[' + this.peerType + ']', ...msg)
        }
    }

    async waitFor(event, timeout = false) {
        return new Promise((resolve, reject) => {
            let rejectTimeout;
            if (timeout !== false) {
                rejectTimeout = setTimeout(() => {
                    reject('Timeout while waiting for event ' + event + ' to fire (timeout: ' + timeout + 'ms)');
                }, +timeout);
            }
            this.once(event, (...params) => {
                if (timeout !== false) {
                    clearTimeout(rejectTimeout)
                }
                resolve(...params);
            });
        });
    }

    get peerList() {
        return Object.values(this.peers);
    }

    get url() {
        return this.signal.url;
    }
}