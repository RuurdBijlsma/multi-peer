import SimplePeerBase from "./MultiPeerBase";

export default class MultiPeerServer extends SimplePeerBase {
    constructor(appName, trickle = true, wrtc = false) {
        super(appName, trickle, wrtc);
        this.broadcastedStreams = [];
        this.peerType = 'server';
    }

    async create(room, password = '', hidden = false) {
        this.signal.create(this.appName, room, password, hidden);
    }

    // On node/electron webSocketOnly might be necessary
    async connect(url, webSocketOnly = false) {
        await super.connect(url, webSocketOnly);

        this.signal.on('initialize', (host, socketId) => {
            this.log('Initializing with ', socketId);
            this.peers[socketId] = this.createPeer(socketId, true)
        });
    }

    broadcast(message) {
        this.log(`Broadcasting to ${this.getConnectedPeerCount()} peers:`, message);
        message = typeof message === 'string' ? message : JSON.stringify(message);
        this.peerList.forEach(p => p.send(message));
    }

    send(id, message) {
        this.log(`Sending to ${id}:`, message);
        message = typeof message === 'string' ? message : JSON.stringify(message);

        if (this.peers.hasOwnProperty(id) && this.peers[id] !== null)
            this.peers[id].send(message);
    }

    broadcastStream(stream) {
        this.broadcastedStreams.push(stream);
        this.log(`Broadcasting stream to ${this.getConnectedPeerCount()} peers: ${stream}`);
        this.peerList.forEach(p => p.addStream(stream));
    }

    broadcastRemoveStream(stream) {
        this.broadcastedStreams.splice(this.broadcastedStreams.indexOf(stream), 1);
        this.log(`broadcastRemoveStream from ${this.getConnectedPeerCount()} peers: ${stream}`);
        this.peerList.forEach(p => p.removeStream(stream));
    }

    sendStream(id, stream) {
        this.log(`Sending stream to ${id}: ${stream}`);
        if (this.peers.hasOwnProperty(id && this.peers[id] !== null))
            this.peers[id].addStream(stream);
    }

    removeStream(id, stream) {
        this.log(`Removing stream from ${id}: ${stream}`);
        if (this.peers.hasOwnProperty(id && this.peers[id] !== null))
            this.peers[id].removeStream(stream);
    }

    // Server needs to be connected to all peers in room
    isFullyConnected() {
        let peerCount = this.getConnectedPeerCount();
        return peerCount + 1 >= this.signal.roomCount;
    }
}