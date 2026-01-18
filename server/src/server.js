import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameManager } from './gameManager.js';
import { DatabaseManager } from './database.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Inicializar managers
const dbManager = new DatabaseManager();
const gameManager = new GameManager(dbManager);

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Manejo de conexiones de Socket.IO
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  // Crear lobby
  socket.on('createLobby', async ({ playerName }) => {
    try {
      const result = await gameManager.createLobby(socket.id, playerName);
      socket.join(result.lobbyCode);
      socket.emit('lobbyCreated', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Unirse a lobby
  socket.on('joinLobby', async ({ lobbyCode, playerName }) => {
    try {
      const result = await gameManager.joinLobby(socket.id, lobbyCode, playerName);
      socket.join(lobbyCode);
      
      // Notificar al jugador que se unió
      socket.emit('lobbyJoined', result);
      
      // Notificar a todos en el lobby
      io.to(lobbyCode).emit('playerJoined', {
        players: result.players,
        newPlayer: result.player
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Reconectar a lobby
  socket.on('reconnect', async ({ lobbyCode, playerId }) => {
    try {
      const result = await gameManager.reconnectPlayer(socket.id, lobbyCode, playerId);
      socket.join(lobbyCode);
      socket.emit('reconnected', result);
      
      // Notificar a otros jugadores que el jugador se reconectó
      socket.to(lobbyCode).emit('playerReconnected', {
        playerId,
        playerName: result.playerName
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Iniciar juego
  socket.on('startGame', async ({ lobbyCode }) => {
    try {
      const result = await gameManager.startGame(lobbyCode);
      io.to(lobbyCode).emit('gameStarted', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Seleccionar pregunta (vaquero)
  socket.on('selectQuestion', async ({ lobbyCode, playerId, selectedIndex }) => {
    try {
      const result = await gameManager.selectQuestion(lobbyCode, playerId, selectedIndex);
      io.to(lobbyCode).emit('questionSelected', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Enviar respuesta
  socket.on('submitAnswer', async ({ lobbyCode, playerId, answer }) => {
    try {
      const result = await gameManager.submitAnswer(lobbyCode, playerId, answer);
      
      // Notificar al jugador
      socket.emit('answerSubmitted');
      
      // Notificar a todos sobre el progreso
      io.to(lobbyCode).emit('answerProgress', {
        submittedCount: result.submittedCount,
        totalPlayers: result.totalPlayers
      });
      
      // Si todos respondieron, pasar a votación
      if (result.allAnswered) {
        io.to(lobbyCode).emit('startVoting', {
          answers: result.answers,
          gameState: result.gameState
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Enviar votos
  socket.on('submitVotes', async ({ lobbyCode, playerId, votedPlayerIds }) => {
    try {
      const result = await gameManager.submitVotes(lobbyCode, playerId, votedPlayerIds);
      
      // Notificar al jugador
      socket.emit('votesSubmitted');
      
      // Notificar a todos sobre el progreso
      io.to(lobbyCode).emit('votingProgress', {
        votedCount: result.votedCount,
        totalPlayers: result.totalPlayers
      });
      
      // Si todos votaron, revelar resultados
      if (result.allVoted) {
        io.to(lobbyCode).emit('roundComplete', result.roundResults);
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Siguiente ronda
  socket.on('nextRound', async ({ lobbyCode }) => {
    try {
      const result = await gameManager.nextRound(lobbyCode);
      io.to(lobbyCode).emit('newRound', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Reiniciar juego
  socket.on('restartGame', async ({ lobbyCode }) => {
    try {
      await gameManager.restartGame(lobbyCode);
      io.to(lobbyCode).emit('gameRestarted');
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    gameManager.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3001;

// Iniciar servidor
async function start() {
  try {
    await dbManager.connect();
    console.log('Base de datos conectada');
    
    httpServer.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar servidor:', error);
    process.exit(1);
  }
}

start();
