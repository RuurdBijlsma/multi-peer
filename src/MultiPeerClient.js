import SimplePeerBase from "./MultiPeerBase";

export default class MultiPeerClient extends SimplePeerBase {
    constructor(appName, trickle = true, wrtc = false) {
        super(appName, trickle, wrtc);
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
    send(message) {
        this.log(`Sending to server:`, message);

        if (this.serverPeer) {
            if (typeof message === 'string')
                this.serverPeer.send(message);
            else
                this.serverPeer.send(JSON.stringify(message));
        }
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

    get serverPeer() {
        return this.peerList[0];
    }
}