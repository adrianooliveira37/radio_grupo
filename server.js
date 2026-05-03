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
  console.log(`Novo usuário conectado: ${socket.id}`);

  // Registra o usuário na sala
  socket.on('register', ({ name, room, peerId }) => {
    socket.join(room);
    socket.userName = name;
    socket.userRoom = room;
    socket.peerId = peerId;

    // Adiciona ou atualiza na lista
    const existingIndex = connectedUsers.findIndex(u => u.peerId === peerId);
    if (existingIndex !== -1) {
      connectedUsers[existingIndex] = { name, room, peerId, isTalking: false };
    } else {
      connectedUsers.push({ name, room, peerId, isTalking: false });
    }

    enviarPresenca(room);
  });

  // Escuta alteração do botão de falar
  socket.on('talking_state', ({ isTalking }) => {
    const user = connectedUsers.find(u => u.peerId === socket.peerId);
    if (user) {
      user.isTalking = isTalking;
      enviarPresenca(socket.userRoom);
    }
  });

  // Retorna a lista de usuários da sala quando alguém solicita ligações
  socket.on('get_active_users', (callback) => {
    const roomUsers = connectedUsers.filter(u => u.room === socket.userRoom);
    callback(roomUsers);
  });

  // Quando alguém desconecta
  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);
    connectedUsers = connectedUsers.filter(u => u.peerId !== socket.peerId);
    if (socket.userRoom) {
      enviarPresenca(socket.userRoom);
    }
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
