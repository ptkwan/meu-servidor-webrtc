const { WebSocketServer } = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor WebRTC Ativo e sem limite de tempo!\n');
});

const wss = new WebSocketServer({ server });
const activeRooms = {};

function broadcast(roomId, message, excludeId) {
    if (!activeRooms[roomId]) return;
    activeRooms[roomId].forEach(client => {
        if (client.id !== excludeId && client.socket.readyState === 1) {
            client.socket.send(JSON.stringify(message));
        }
    });
}

function sendTo(roomId, targetId, message) {
    if (!activeRooms[roomId]) return;
    const target = activeRooms[roomId].find(c => c.id === targetId);
    if (target && target.socket.readyState === 1) {
        target.socket.send(JSON.stringify(message));
    }
}

wss.on('connection', (socket) => {
    const socketId = Math.random().toString(36).substring(2, 15);
    let currentRoom = null;
    let currentUser = null;

    socket.send(JSON.stringify({ type: 'welcome', payload: socketId }));

    socket.on('message', (messageAsString) => {
        const data = JSON.parse(messageAsString);
        const { type, payload } = data;

        if (type === 'join-room') {
            currentRoom = payload.roomId;
            currentUser = payload.username || `User-${socketId}`;

            if (!activeRooms[currentRoom]) activeRooms[currentRoom] = [];
            activeRooms[currentRoom].push({ id: socketId, name: currentUser, socket });

            const userList = activeRooms[currentRoom].map(c => ({ id: c.id, name: c.name }));
            
            socket.send(JSON.stringify({ type: 'update-user-list', payload: userList }));
            broadcast(currentRoom, { type: 'user-connected', payload: { userId: socketId, userName: currentUser } }, socketId);
            broadcast(currentRoom, { type: 'update-user-list', payload: userList }, socketId);
        }
        else if (type === 'start-sharing') {
            broadcast(currentRoom, { type: 'broadcaster-started', payload: socketId }, socketId);
        }
        else if (type === 'request-stream') {
            sendTo(currentRoom, payload, { type: 'viewer-requested', payload: socketId });
        }
        else if (type === 'offer' || type === 'answer' || type === 'ice-candidate') {
            sendTo(currentRoom, payload.target, { type, payload });
        }
    });

    socket.on('close', () => {
        if (currentRoom && activeRooms[currentRoom]) {
            activeRooms[currentRoom] = activeRooms[currentRoom].filter(c => c.id !== socketId);
            if (activeRooms[currentRoom].length === 0) {
                delete activeRooms[currentRoom];
            } else {
                const userList = activeRooms[currentRoom].map(c => ({ id: c.id, name: c.name }));
                broadcast(currentRoom, { type: 'update-user-list', payload: userList }, socketId);
                broadcast(currentRoom, { type: 'user-disconnected', payload: socketId }, socketId);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
