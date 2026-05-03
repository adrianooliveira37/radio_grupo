const express = require('express');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let connectedUsers = [];

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);

  socket.on('register', ({ name, room, peerId }) => {
    socket.join(room);
    socket.userName = name;
    socket.userRoom = room;
    socket.peerId = peerId;

    // Evita duplicidade de usuários
    connectedUsers = connectedUsers.filter(u => u.peerId !== peerId);
    connectedUsers.push({ name, room, peerId, isTalking: false });

    enviarPresenca(room);
  });

  socket.on('talking_state', ({ isTalking }) => {
    const user = connectedUsers.find(u => u.peerId === socket.peerId);
    if (user) {
      user.isTalking = isTalking;
      enviarPresenca(socket.userRoom);
    }
  });

  // Retorna a lista atualizada de quem está na sala
  socket.on('get_active_users', (callback) => {
    const roomUsers = connectedUsers.filter(u => u.room === socket.userRoom);
    callback(roomUsers);
  });

  socket.on('disconnect', () => {
    connectedUsers = connectedUsers.filter(u => u.peerId !== socket.peerId);
    if (socket.userRoom) {
      enviarPresenca(socket.userRoom);
    }
    console.log(`Socket desconectado: ${socket.id}`);
  });

  function enviarPresenca(room) {
    const roomUsers = connectedUsers.filter(u => u.room === room);
    io.to(room).emit('presence', roomUsers);
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
