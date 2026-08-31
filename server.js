const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Armazenar salas: roomId -> Set de socket ids
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username || 'Anônimo';
    socket.data.room = roomId;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    // Atualizar lista de usuários para todos na sala
    const users = Array.from(rooms.get(roomId)).map(id => ({
      id,
      name: io.sockets.sockets.get(id)?.data.username || 'Anônimo'
    }));
    io.to(roomId).emit('update-user-list', users);

    // Notificar entrada
    socket.to(roomId).emit('user-connected', { userId: socket.id, userName: socket.data.username });
  });

  socket.on('start-sharing', () => {
    const room = socket.data.room;
    if (room) {
      socket.to(room).emit('broadcaster-started', { userId: socket.id });
    }
  });

  socket.on('request-stream', ({ userId }) => {
    io.to(userId).emit('viewer-requested', socket.id);
  });

  socket.on('offer', ({ target, sdp, caller }) => {
    io.to(target).emit('offer', { caller: socket.id, sdp });
  });

  socket.on('answer', ({ target, sdp, answerer }) => {
    io.to(target).emit('answer', { answerer: socket.id, sdp });
  });

  socket.on('ice-candidate', ({ target, candidate, sender }) => {
    io.to(target).emit('ice-candidate', { sender: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    const room = socket.data.room;
    if (room && rooms.has(room)) {
      rooms.get(room).delete(socket.id);
      if (rooms.get(room).size === 0) {
        rooms.delete(room);
      } else {
        const users = Array.from(rooms.get(room)).map(id => ({
          id,
          name: io.sockets.sockets.get(id)?.data.username || 'Anônimo'
        }));
        io.to(room).emit('update-user-list', users);
        io.to(room).emit('user-disconnected', socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));