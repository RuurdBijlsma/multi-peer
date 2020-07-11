import MultiPeerBase from "./MultiPeerBase";

export default class MultiPeerClient extends MultiPeerBase {
    constructor(appName, buffered = false, trickle = true, wrtc = false) {
        super(appName, buffered, trickle, wrtc);
        this.peerType = 'client';
    }

    async join(room, password = '') {
        this.signal.join(this.appName, room, password);
        this.room = room;
        let roomCount = await this.signal.waitFor('room-count', 5000);
        this.checkFullConnect()
        if (roomCount !== 1)
            await this.waitFor('full-connect', 10000);
    }

    //Send to server
    send(message, raw = false) {
        this.log(`Sending to server:`, message);
        this.sendToPeer(this.serverPeerId, message, raw);
    }

    //Send to server
    sendStream(stream) {
        this.log(`Sending stream to server:`, stream);
        if (this.serverPeer)
            this.serverPeer.addStream(stream);
    }

    removeStream(id, stream) {
        this.log(`Removing stream from server:`, stream);
        if (this.serverPeer)
            this.serverPeer.removeStream(stream);
    }

    isFullyConnected() {
        // Client only has 1 peer, the server
        return this.getConnectedPeerCount() === 1;
    }

    get serverPeerId() {
        return Object.keys(this.peers)[0];
    }

    get serverPeer() {
        return this.peers[this.serverPeerId];
    }
}