const express = require('express');
const http = require('http');
const path = require('path');
const { ExpressPeerServer } = require('peer');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuração do servidor PeerJS integrado
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/peerjs',
  proxied: true
});

app.use(peerServer);

// Servir arquivos estáticos e rotas
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/grupo.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'grupo.html'));
});

let rooms = {};

io.on('connection', (socket) => {
  console.log('🟢 Novo cliente conectado ao Socket.io:', socket.id);

  socket.on('register', (data) => {
    const { room, peerId, name } = data;

    if (!room || !peerId || !name) {
      console.log('⚠️ Dados de registro inválidos:', data);
      return;
    }

    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = {};
    }

    rooms[room][socket.id] = {
      peerId: peerId,
      name: name,
      isTalking: false,
      room: room
    };

    console.log(`👤 [${room}] Usuário registrado: ${name} (${peerId})`);
    broadcastPresence(room);
  });

  // ==================== EVENTO NOVO/CORRIGIDO ====================
  // Permite que o frontend peça a lista de usuários da sala antes de ligar para todos
  socket.on('get_active_users', (callback) => {
    const userRoom = getUserRoom(socket.id);
    if (userRoom && rooms[userRoom]) {
      // Retorna a lista de usuários da mesma sala
      callback(Object.values(rooms[userRoom]));
    } else {
      callback([]);
    }
  });
  // ===============================================================

  socket.on('talking_state', (data) => {
    const userRoom = getUserRoom(socket.id);

    if (userRoom && rooms[userRoom] && rooms[userRoom][socket.id]) {
      rooms[userRoom][socket.id].isTalking = data.isTalking;
      
      socket.to(userRoom).emit('user_talking', {
        peerId: rooms[userRoom][socket.id].peerId,
        name: rooms[userRoom][socket.id].name,
        isTalking: data.isTalking
      });

      broadcastPresence(userRoom);
    }
  });

  socket.on('disconnect', () => {
    const userRoom = getUserRoom(socket.id);

    if (userRoom && rooms[userRoom]) {
      const user = rooms[userRoom][socket.id];
      console.log(`🔴 Usuário saiu da sala [${userRoom}]: ${user.name}`);

      if (user.isTalking) {
        socket.to(userRoom).emit('user_talking', {
          peerId: user.peerId,
          name: user.name,
          isTalking: false
        });
      }

      delete rooms[userRoom][socket.id];

      if (Object.keys(rooms[userRoom]).length === 0) {
        delete rooms[userRoom];
      } else {
        broadcastPresence(userRoom);
      }
    }
  });

  function broadcastPresence(room) {
    if (rooms[room]) {
      const userList = Object.values(rooms[room]);
      io.to(room).emit('presence', userList);
    }
  }

  function getUserRoom(socketId) {
    for (const room in rooms) {
      if (rooms[room][socketId]) {
        return room;
      }
    }
    return null;
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
