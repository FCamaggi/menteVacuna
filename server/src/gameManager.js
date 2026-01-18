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
      lobby,
      cowboyId: lobby.currentCowboyIndex !== undefined ? lobby.players[lobby.currentCowboyIndex].id : null
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

    lobby.gameState = 'choosing_question';
    lobby.currentRound = 1;
    lobby.currentCowboyIndex = 0; // Índice del vaquero actual
    lobby.questionOptions = [
      this.getRandomQuestion(lobby.usedQuestions || []),
      this.getRandomQuestion(lobby.usedQuestions || [])
    ];
    lobby.currentQuestion = null;
    lobby.answers = [];
    lobby.votes = [];
    lobby.usedQuestions = lobby.usedQuestions || [];

    await this.dbManager.saveLobby(lobby);

    return {
      gameState: lobby.gameState,
      currentRound: lobby.currentRound,
      cowboyId: lobby.players[lobby.currentCowboyIndex].id,
      questionOptions: lobby.questionOptions,
      players: lobby.players
    };
  }

  // Seleccionar pregunta (vaquero)
  async selectQuestion(lobbyCode, playerId, selectedIndex) {
    const lobby = await this.dbManager.getLobby(lobbyCode);
    
    if (!lobby) {
      throw new Error('Lobby no encontrado');
    }

    const cowboy = lobby.players[lobby.currentCowboyIndex];
    if (cowboy.id !== playerId) {
      throw new Error('No eres el vaquero de esta ronda');
    }

    if (selectedIndex < 0 || selectedIndex > 1) {
      throw new Error('Índice de pregunta inválido');
    }

    // Guardar la pregunta seleccionada
    lobby.currentQuestion = lobby.questionOptions[selectedIndex];
    lobby.usedQuestions.push(lobby.currentQuestion);
    
    // La pregunta no seleccionada vuelve a estar disponible
    // (no se añade a usedQuestions)
    
    lobby.gameState = 'answering';
    lobby.questionOptions = null;

    await this.dbManager.saveLobby(lobby);

    return {
      gameState: lobby.gameState,
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

    if (lobby.gameState !== 'answering') {
      throw new Error('No es el momento de responder');
    }

    // Verificar si ya respondió
    if (lobby.answers.find(a => a.playerId === playerId)) {
      throw new Error('Ya has enviado tu respuesta');
    }

    const player = lobby.players.find(p => p.id === playerId);

    lobby.answers.push({
      playerId,
      playerName: player.name,
      answer: answer.trim()
    });

    await this.dbManager.saveLobby(lobby);

    const allAnswered = lobby.answers.length === lobby.players.length;
    
    if (allAnswered) {
      lobby.gameState = 'voting';
      lobby.votes = [];
      await this.dbManager.saveLobby(lobby);
    }

    return {
      submittedCount: lobby.answers.length,
      totalPlayers: lobby.players.length,
      allAnswered,
      answers: allAnswered ? lobby.answers : null,
      gameState: allAnswered ? 'voting' : lobby.gameState
    };
  }

  // Enviar votos
  async submitVotes(lobbyCode, playerId, votedPlayerIds) {
    const lobby = await this.dbManager.getLobby(lobbyCode);
    
    if (!lobby) {
      throw new Error('Lobby no encontrado');
    }

    if (lobby.gameState !== 'voting') {
      throw new Error('No es el momento de votar');
    }

    // Verificar si ya votó
    const existingVote = lobby.votes.find(v => v.playerId === playerId);
    if (existingVote) {
      throw new Error('Ya has enviado tus votos');
    }

    lobby.votes.push({
      playerId,
      votedFor: votedPlayerIds
    });

    await this.dbManager.saveLobby(lobby);

    const allVoted = lobby.votes.length === lobby.players.length;
    
    let roundResults = null;
    if (allVoted) {
      roundResults = await this.calculateVotingResults(lobby);
    }

    return {
      votedCount: lobby.votes.length,
      totalPlayers: lobby.players.length,
      allVoted,
      roundResults
    };
  }

  // Calcular resultados usando lógica de union-find
  async calculateVotingResults(lobby) {
    const playerIds = lobby.players.map(p => p.id);
    const parent = {};
    
    // Inicializar union-find
    playerIds.forEach(id => {
      parent[id] = id;
    });

    // Función find con compresión de camino
    function find(x) {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    }

    // Función union
    function union(x, y) {
      const rootX = find(x);
      const rootY = find(y);
      if (rootX !== rootY) {
        parent[rootX] = rootY;
      }
    }

    // Procesar votos: si A votó por B, entonces A y B son del mismo grupo
    lobby.votes.forEach(vote => {
      vote.votedFor.forEach(votedId => {
        union(vote.playerId, votedId);
      });
    });

    // Agrupar jugadores por sus raíces
    const groups = {};
    playerIds.forEach(id => {
      const root = find(id);
      if (!groups[root]) {
        groups[root] = [];
      }
      groups[root].push(id);
    });

    // Encontrar el grupo mayoritario
    let largestGroup = [];
    let maxSize = 0;
    
    Object.values(groups).forEach(group => {
      if (group.length > maxSize) {
        maxSize = group.length;
        largestGroup = group;
      }
    });

    const majorityGroup = maxSize > 1 ? largestGroup : null;

    // Identificar jugadores únicos (nadie votó que son iguales)
    const uniquePlayers = [];
    Object.values(groups).forEach(group => {
      if (group.length === 1) {
        const playerId = group[0];
        // Verificar que nadie votó por él (excepto él mismo)
        const votedByOthers = lobby.votes.some(vote => 
          vote.playerId !== playerId && vote.votedFor.includes(playerId)
        );
        if (!votedByOthers) {
          uniquePlayers.push(playerId);
        }
      }
    });

    // Actualizar puntuaciones y vaca rosa
    const results = [];
    
    // Primero, quitar la vaca rosa de todos
    lobby.players.forEach(player => {
      player.hasPinkCow = false;
    });

    lobby.answers.forEach(({ playerId, playerName, answer }) => {
      const player = lobby.players.find(p => p.id === playerId);
      
      let scored = false;
      let gotPinkCow = false;

      // Dar puntos a jugadores del grupo mayoritario
      if (majorityGroup && majorityGroup.includes(playerId)) {
        player.score += 1;
        scored = true;
      }

      // Dar vaca rosa a jugadores únicos
      if (uniquePlayers.includes(playerId)) {
        player.hasPinkCow = true;
        gotPinkCow = true;
      }

      results.push({
        playerId,
        playerName,
        answer,
        scored,
        gotPinkCow,
        newScore: player.score,
        groupSize: groups[find(playerId)].length
      });
    });

    // Verificar ganador
    const winner = lobby.players.find(p => p.score >= 8 && !p.hasPinkCow);
    
    if (winner) {
      lobby.gameState = 'finished';
      lobby.winner = winner;
    } else {
      lobby.gameState = 'results';
    }

    await this.dbManager.saveLobby(lobby);

    return {
      results,
      groups: Object.values(groups).map(group => ({
        playerIds: group,
        size: group.length
      })),
      majorityGroup,
      players: lobby.players,
      votes: lobby.votes,
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
    
    // Rotar al siguiente vaquero
    lobby.currentCowboyIndex = (lobby.currentCowboyIndex + 1) % lobby.players.length;
    
    lobby.questionOptions = [
      this.getRandomQuestion(lobby.usedQuestions),
      this.getRandomQuestion(lobby.usedQuestions)
    ];
    lobby.currentQuestion = null;
    lobby.answers = [];
    lobby.votes = [];
    lobby.gameState = 'choosing_question';

    await this.dbManager.saveLobby(lobby);

    return {
      currentRound: lobby.currentRound,
      gameState: lobby.gameState,
      cowboyId: lobby.players[lobby.currentCowboyIndex].id,
      questionOptions: lobby.questionOptions,
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
    lobby.currentCowboyIndex = 0;
    lobby.currentQuestion = null;
    lobby.questionOptions = null;
    lobby.answers = [];
    lobby.votes = [];
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
