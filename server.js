const {PeerServer} = require("peer");

const PORT = 443;

const peerServer = PeerServer({
    port: PORT, key: "peerjs", path: "/myapp", allow_discovery: true
})

peerServer.on("connection", c => {
    console.log("Connection ID: ", c.id);
})

peerServer.on("disconnect", c => {
    console.log("disconnect!", c.id);
})

console.log(`Running Peer JS server on port ${PORT}!`);

