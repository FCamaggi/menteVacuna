import { QUESTIONS } from './questions.js';

export class GameManager {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.socketToPlayer = new Map(); // socket.id -> { lobbyCode, playerId }
  }

  // Generar código de lobby único
  generateLobbyCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Crear lobby
  async createLobby(socketId, playerName) {
    const lobbyCode = this.generateLobbyCode();
    const playerId = this.generatePlayerId();
    
    const lobby = {
      lobbyCode,
      createdAt: new Date(),
      host: playerId,
      players: [{
        id: playerId,
        name: playerName,
        socketId,
        score: 0,
        hasPinkCow: false,
        connected: true
      }],
      gameState: 'waiting', // waiting, playing, finished
      currentRound: 0,
      currentQuestion: null,
      answers: [],
      usedQuestions: []
    };

    await this.dbManager.saveLobby(lobby);
    this.socketToPlayer.set(socketId, { lobbyCode, playerId });

    return {
      lobbyCode,
      playerId,
      playerName,
      isHost: true,
      lobby
    };
  }

  // Unirse a lobby
  async joinLobby(socketId, lobbyCode, playerName) {
    const lobby = await this.dbManager.getLobby(lobbyCode);
    
    if (!lobby) {
      throw new Error('Lobby no encontrado');
    }

    if (lobby.gameState === 'playing') {
      throw new Error('El juego ya ha comenzado');
    }

    if (lobby.players.length >= 10) {
      throw new Error('Lobby lleno');
    }

    const playerId = this.generatePlayerId();
    const player = {
      id: playerId,
      name: playerName,
      socketId,
      score: 0,
      hasPinkCow: false,
      connected: true
    };

    lobby.players.push(player);
    await this.dbManager.saveLobby(lobby);
    this.socketToPlayer.set(socketId, { lobbyCode, playerId });

    return {
      lobbyCode,
      playerId,
      playerName,
      isHost: lobby.host === playerId,
      players: lobby.players,
      player
    };
  }

  // Reconectar jugador
  async reconnectPlayer(socketId, lobbyCode, playerId) {
    const lobby = await this.dbManager.getLobby(lobbyCode);
    
    if (!lobby) {
      throw new Error('Lobby no encontrado');
    }

    const player = lobby.players.find(p => p.id === playerId);
    
    if (!player) {
      throw new Error('Jugador no encontrado en este lobby');
    }

    // Actualizar socket ID y estado de conexión
    player.socketId = socketId;
    player.connected = true;

    await this.dbManager.saveLobby(lobby);
    this.socketToPlayer.set(socketId, { lobbyCode, playerId });

    return {
      lobbyCode,
      playerId,
      playerName: player.name,
      isHost: lobby.host === playerId,
      lobby
    };
  }

  // Iniciar juego
  async startGame(lobbyCode) {
    const lobby = await this.dbManager.getLobby(lobbyCode);
    
    if (!lobby) {
      throw new Error('Lobby no encontrado');
    }

    if (lobby.players.length < 2) {
      throw new Error('Se necesitan al menos 2 jugadores');
    }

    lobby.gameState = 'playing';
    lobby.currentRound = 1;
    lobby.currentQuestion = this.getRandomQuestion(lobby.usedQuestions);
    lobby.usedQuestions.push(lobby.currentQuestion);
    lobby.answers = [];

    await this.dbManager.saveLobby(lobby);

    return {
      gameState: lobby.gameState,
      currentRound: lobby.currentRound,
      question: lobby.currentQuestion,
      players: lobby.players
    };
  }

  // Enviar respuesta
  async submitAnswer(lobbyCode, playerId, answer) {
    const lobby = await this.dbManager.getLobby(lobbyCode);
    
    if (!lobby) {
      throw new Error('Lobby no encontrado');
    }

    if (lobby.gameState !== 'playing') {
      throw new Error('El juego no está en curso');
    }

    // Verificar si ya respondió
    if (lobby.answers.find(a => a.playerId === playerId)) {
      throw new Error('Ya has enviado tu respuesta');
    }

    lobby.answers.push({
      playerId,
      answer: answer.trim().toLowerCase()
    });

    await this.dbManager.saveLobby(lobby);

    const allAnswered = lobby.answers.length === lobby.players.length;
    
    let roundResults = null;
    if (allAnswered) {
      roundResults = await this.calculateRoundResults(lobby);
    }

    return {
      submittedCount: lobby.answers.length,
      totalPlayers: lobby.players.length,
      allAnswered,
      roundResults
    };
  }

  // Calcular resultados de la ronda
  async calculateRoundResults(lobby) {
    const answerCounts = {};
    
    // Contar respuestas
    lobby.answers.forEach(({ answer }) => {
      answerCounts[answer] = (answerCounts[answer] || 0) + 1;
    });

    // Encontrar la respuesta mayoritaria
    let maxCount = 0;
    let majorityAnswers = [];
    
    Object.entries(answerCounts).forEach(([answer, count]) => {
      if (count > maxCount) {
        maxCount = count;
        majorityAnswers = [answer];
      } else if (count === maxCount && count > 1) {
        majorityAnswers.push(answer);
      }
    });

    // Solo hay mayoría si hay una respuesta clara (no empate)
    const hasMajority = majorityAnswers.length === 1 && maxCount > 1;
    const majorityAnswer = hasMajority ? majorityAnswers[0] : null;

    // Identificar respuestas únicas
    const uniqueAnswers = Object.entries(answerCounts)
      .filter(([_, count]) => count === 1)
      .map(([answer]) => answer);

    // Actualizar puntuaciones y vaca rosa
    const results = [];
    
    // Primero, quitar la vaca rosa de todos
    lobby.players.forEach(player => {
      player.hasPinkCow = false;
    });

    lobby.answers.forEach(({ playerId, answer }) => {
      const player = lobby.players.find(p => p.id === playerId);
      const playerName = player.name;
      
      let scored = false;
      let gotPinkCow = false;

      // Dar puntos a respuestas mayoritarias
      if (hasMajority && answer === majorityAnswer) {
        player.score += 1;
        scored = true;
      }

      // Dar vaca rosa a respuestas únicas
      if (uniqueAnswers.includes(answer)) {
        player.hasPinkCow = true;
        gotPinkCow = true;
      }

      results.push({
        playerId,
        playerName,
        answer,
        scored,
        gotPinkCow,
        newScore: player.score
      });
    });

    // Verificar ganador
    const winner = lobby.players.find(p => p.score >= 8 && !p.hasPinkCow);
    
    if (winner) {
      lobby.gameState = 'finished';
      lobby.winner = winner;
    }

    await this.dbManager.saveLobby(lobby);

    return {
      results,
      majorityAnswer,
      answerCounts,
      players: lobby.players,
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        score: winner.score
      } : null,
      gameState: lobby.gameState
    };
  }

  // Siguiente ronda
  async nextRound(lobbyCode) {
    const lobby = await this.dbManager.getLobby(lobbyCode);
    
    if (!lobby) {
      throw new Error('Lobby no encontrado');
    }

    lobby.currentRound += 1;
    lobby.currentQuestion = this.getRandomQuestion(lobby.usedQuestions);
    lobby.usedQuestions.push(lobby.currentQuestion);
    lobby.answers = [];

    await this.dbManager.saveLobby(lobby);

    return {
      currentRound: lobby.currentRound,
      question: lobby.currentQuestion,
      players: lobby.players
    };
  }

  // Reiniciar juego
  async restartGame(lobbyCode) {
    const lobby = await this.dbManager.getLobby(lobbyCode);
    
    if (!lobby) {
      throw new Error('Lobby no encontrado');
    }

    lobby.gameState = 'waiting';
    lobby.currentRound = 0;
    lobby.currentQuestion = null;
    lobby.answers = [];
    lobby.usedQuestions = [];
    lobby.winner = null;
    
    lobby.players.forEach(player => {
      player.score = 0;
      player.hasPinkCow = false;
    });

    await this.dbManager.saveLobby(lobby);
  }

  // Manejar desconexión
  handleDisconnect(socketId) {
    const playerInfo = this.socketToPlayer.get(socketId);
    
    if (playerInfo) {
      const { lobbyCode, playerId } = playerInfo;
      
      // Marcar jugador como desconectado (no eliminarlo para permitir reconexión)
      this.dbManager.getLobby(lobbyCode).then(lobby => {
        if (lobby) {
          const player = lobby.players.find(p => p.id === playerId);
          if (player) {
            player.connected = false;
            this.dbManager.saveLobby(lobby);
          }
        }
      });
      
      this.socketToPlayer.delete(socketId);
    }
  }

  // Obtener pregunta aleatoria
  getRandomQuestion(usedQuestions) {
    const availableQuestions = QUESTIONS.filter(q => !usedQuestions.includes(q));
    
    if (availableQuestions.length === 0) {
      // Si se acabaron las preguntas, reiniciar el pool
      return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    }
    
    return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  }

  // Generar ID de jugador único
  generatePlayerId() {
    return Math.random().toString(36).substring(2, 15);
  }
}
