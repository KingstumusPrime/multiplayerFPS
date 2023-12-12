async function getPeers(peer){
    const response = await fetch("https://tic-attack-toe-server.onrender.com/myapp/peerjs/peers");

    const peersArr = await response.json();
    if(peer.id == peersArr[0]){
        //isHost = true;
    }else{
        //isHost = false;
    }
    const list = peersArr ?? [];
    return list.filter((id) => id !== peer.id);
}

class Client {
    constructor(){
        this.conns = {};
        this.pid;
        this.peer;
    }

    async init(){
        return await new Promise(async (resolve, reject) => {
            this.peer = await new Peer('', {
                host: 'tic-attack-toe-server.onrender.com',
                port: '443',
                path: '/myapp',
                key: 'peerjs'
              });
            this.peer.on("open", async (id) =>  {
                this.pid = id;
                await this.initConns();
                resolve();
            });
        
        })

    }

    async initConns(){
        return await new Promise( async (resolve, reject) => {
            const peers = await getPeers(this.peer);
            for (const p of peers) {
                const conn = this.peer.connect(p, {reliable: true})
                await this.connect(conn);
            }
            this.onCreate(this.conns);
    
            this.peer.on("connection",async (conn) => {
                await this.connect(conn);
            });
            resolve();
        })

    }

    // creates a new connection
    async connect(conn){
        const promise = new Promise((resolve, reject) => {
            conn.on("open", () => {
                this.conns[conn.peer] = conn;
                this.onConnect(conn);
    
                conn.on("data", d => {
                    this.handleData(d);
                });
    
                conn.on("close", () => {
                    this.onClientDisconnect(conn.peer);
                    delete this.conns[conn.peer]
                });
    
                window.addEventListener("unload", () => {
                    conn.close();
                });
                resolve();
            });
        });
       
        return await promise;
    }

    broadcastAll(message, toSelf=false){
        Object.values(this.conns).forEach(conn => {
            conn.send(message);
        })
        if(toSelf){
            this.handleData(message);
        }
    }

    broadcastTo(id, message){
        this.conns[id].send(message);
    }

    // meant to be written by whoever is making the game
    handleData(d){}
    onConnect(c){}
    onCreate(conns){};
    onClientDisconnect(pid){};
}

export {Client};