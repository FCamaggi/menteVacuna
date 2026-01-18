import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('menu'); // menu, lobby, playing, results, finished
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerProgress, setAnswerProgress] = useState({ submitted: 0, total: 0 });
  const [roundResults, setRoundResults] = useState(null);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');

  // Conectar socket al montar
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    // Intentar reconectar si hay datos guardados
    const savedData = localStorage.getItem('menteVacunaSession');
    if (savedData) {
      const { lobbyCode: savedLobbyCode, playerId: savedPlayerId } = JSON.parse(savedData);
      newSocket.emit('reconnect', { lobbyCode: savedLobbyCode, playerId: savedPlayerId });
    }

    return () => newSocket.close();
  }, []);

  // Configurar listeners de socket
  useEffect(() => {
    if (!socket) return;

    socket.on('lobbyCreated', (data) => {
      setLobbyCode(data.lobbyCode);
      setPlayerId(data.playerId);
      setIsHost(true);
      setPlayers(data.lobby.players);
      setGameState('lobby');
      
      // Guardar sesión
      localStorage.setItem('menteVacunaSession', JSON.stringify({
        lobbyCode: data.lobbyCode,
        playerId: data.playerId
      }));
    });

    socket.on('lobbyJoined', (data) => {
      setLobbyCode(data.lobbyCode);
      setPlayerId(data.playerId);
      setIsHost(data.isHost);
      setPlayers(data.players);
      setGameState('lobby');
      
      // Guardar sesión
      localStorage.setItem('menteVacunaSession', JSON.stringify({
        lobbyCode: data.lobbyCode,
        playerId: data.playerId
      }));
    });

    socket.on('reconnected', (data) => {
      setLobbyCode(data.lobbyCode);
      setPlayerId(data.playerId);
      setIsHost(data.isHost);
      setPlayers(data.lobby.players);
      setCurrentQuestion(data.lobby.currentQuestion);
      setCurrentRound(data.lobby.currentRound);
      
      if (data.lobby.gameState === 'playing') {
        setGameState('playing');
        // Verificar si ya respondió
        const hasPlayerAnswered = data.lobby.answers.some(a => a.playerId === data.playerId);
        setHasAnswered(hasPlayerAnswered);
        setAnswerProgress({
          submitted: data.lobby.answers.length,
          total: data.lobby.players.length
        });
      } else if (data.lobby.gameState === 'finished') {
        setGameState('finished');
        setWinner(data.lobby.winner);
      } else {
        setGameState('lobby');
      }
    });

    socket.on('playerJoined', (data) => {
      setPlayers(data.players);
    });

    socket.on('gameStarted', (data) => {
      setGameState('playing');
      setCurrentQuestion(data.question);
      setCurrentRound(data.currentRound);
      setPlayers(data.players);
      setHasAnswered(false);
      setAnswer('');
      setAnswerProgress({ submitted: 0, total: data.players.length });
    });

    socket.on('answerSubmitted', () => {
      setHasAnswered(true);
    });

    socket.on('answerProgress', (data) => {
      setAnswerProgress({ submitted: data.submittedCount, total: data.totalPlayers });
    });

    socket.on('roundComplete', (data) => {
      setRoundResults(data);
      setPlayers(data.players);
      setGameState('results');
      
      if (data.winner) {
        setWinner(data.winner);
        setGameState('finished');
      }
    });

    socket.on('newRound', (data) => {
      setCurrentQuestion(data.question);
      setCurrentRound(data.currentRound);
      setPlayers(data.players);
      setHasAnswered(false);
      setAnswer('');
      setRoundResults(null);
      setGameState('playing');
      setAnswerProgress({ submitted: 0, total: data.players.length });
    });

    socket.on('gameRestarted', () => {
      setGameState('lobby');
      setCurrentRound(0);
      setCurrentQuestion('');
      setAnswer('');
      setHasAnswered(false);
      setRoundResults(null);
      setWinner(null);
    });

    socket.on('error', (data) => {
      setError(data.message);
      setTimeout(() => setError(''), 5000);
    });

    return () => {
      socket.off('lobbyCreated');
      socket.off('lobbyJoined');
      socket.off('reconnected');
      socket.off('playerJoined');
      socket.off('gameStarted');
      socket.off('answerSubmitted');
      socket.off('answerProgress');
      socket.off('roundComplete');
      socket.off('newRound');
      socket.off('gameRestarted');
      socket.off('error');
    };
  }, [socket]);

  const createLobby = () => {
    if (!playerName.trim()) {
      setError('Por favor ingresa tu nombre');
      return;
    }
    socket.emit('createLobby', { playerName: playerName.trim() });
  };

  const joinLobby = () => {
    if (!playerName.trim() || !lobbyCode.trim()) {
      setError('Por favor ingresa tu nombre y el código del lobby');
      return;
    }
    socket.emit('joinLobby', { 
      lobbyCode: lobbyCode.trim().toUpperCase(), 
      playerName: playerName.trim() 
    });
  };

  const startGame = () => {
    socket.emit('startGame', { lobbyCode });
  };

  const submitAnswer = () => {
    if (!answer.trim()) {
      setError('Por favor escribe una respuesta');
      return;
    }
    socket.emit('submitAnswer', { 
      lobbyCode, 
      playerId, 
      answer: answer.trim() 
    });
  };

  const nextRound = () => {
    socket.emit('nextRound', { lobbyCode });
  };

  const restartGame = () => {
    socket.emit('restartGame', { lobbyCode });
  };

  const leaveLobby = () => {
    localStorage.removeItem('menteVacunaSession');
    window.location.reload();
  };

  // Renderizado del menú principal
  if (gameState === 'menu') {
    return (
      <div className="container">
        <h1 className="game-title">🐮 Mente Vacuna 🐮</h1>
        <p className="game-subtitle">¡Piensa como un rebaño!</p>

        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <label>Tu Nombre</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Ingresa tu nombre"
            maxLength={20}
          />
        </div>

        <button className="btn btn-primary" onClick={createLobby}>
          Crear Nueva Partida
        </button>

        <div style={{ margin: '20px 0', textAlign: 'center', color: '#999' }}>
          - O -
        </div>

        <div className="form-group">
          <label>Código de Lobby</label>
          <input
            type="text"
            value={lobbyCode}
            onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
            placeholder="Ingresa el código"
            maxLength={6}
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        <button className="btn btn-secondary" onClick={joinLobby}>
          Unirse a Partida
        </button>

        <div className="rules-section">
          <h3>📋 Reglas del Juego</h3>
          <ul>
            <li>Todos los jugadores responden la misma pregunta en secreto</li>
            <li>Ganas 1 punto si tu respuesta coincide con la mayoría</li>
            <li>Si das una respuesta única, recibes la vaca rosa 🌸</li>
            <li>Para ganar necesitas 8 puntos SIN tener la vaca rosa</li>
          </ul>
        </div>
      </div>
    );
  }

  // Renderizado del lobby
  if (gameState === 'lobby') {
    return (
      <div className="container">
        <h1 className="game-title">🐮 Mente Vacuna 🐮</h1>
        
        <div className="lobby-code">{lobbyCode}</div>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Comparte este código con tus amigos
        </p>

        {error && <div className="error">{error}</div>}

        <div className="players-list">
          <h3>Jugadores ({players.length})</h3>
          {players.map((player) => (
            <div key={player.id} className="player-item">
              <span className="player-name">
                {player.name} {player.id === playerId && '(Tú)'}
                {!player.connected && ' [Desconectado]'}
              </span>
            </div>
          ))}
        </div>

        {isHost && players.length >= 2 && (
          <button className="btn btn-primary" onClick={startGame}>
            Iniciar Juego
          </button>
        )}

        {isHost && players.length < 2 && (
          <p className="game-status">Esperando más jugadores... (mínimo 2)</p>
        )}

        {!isHost && (
          <p className="game-status">Esperando que el anfitrión inicie el juego...</p>
        )}

        <button className="btn btn-secondary" onClick={leaveLobby}>
          Salir del Lobby
        </button>
      </div>
    );
  }

  // Renderizado del juego
  if (gameState === 'playing') {
    return (
      <div className="container">
        <h1 className="game-title">🐮 Mente Vacuna 🐮</h1>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div><strong>Ronda:</strong> {currentRound}</div>
          <div><strong>Lobby:</strong> {lobbyCode}</div>
        </div>

        <div className="players-list">
          {players.map((player) => (
            <div key={player.id} className="player-item">
              <span className="player-name">
                {player.name}
                {player.id === playerId && ' (Tú)'}
              </span>
              <span className="player-score">
                <span className="cow-icon">🐄</span>
                {player.score}
                {player.hasPinkCow && <span className="pink-cow">🌸</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="question-card">
          {currentQuestion}
        </div>

        <div className="answer-section">
          {!hasAnswered ? (
            <>
              <input
                type="text"
                className="answer-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Escribe tu respuesta..."
                maxLength={50}
                onKeyPress={(e) => e.key === 'Enter' && submitAnswer()}
              />
              <button className="btn btn-primary" onClick={submitAnswer}>
                Enviar Respuesta
              </button>
            </>
          ) : (
            <div className="game-status">
              ✅ Respuesta enviada. Esperando a los demás...
              <div style={{ marginTop: '10px' }}>
                {answerProgress.submitted} / {answerProgress.total} jugadores han respondido
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Renderizado de resultados
  if (gameState === 'results') {
    return (
      <div className="container">
        <h1 className="game-title">📊 Resultados de la Ronda {currentRound}</h1>

        {roundResults.majorityAnswer && (
          <div className="game-status">
            Respuesta mayoritaria: <strong>{roundResults.majorityAnswer}</strong>
          </div>
        )}

        <div className="answers-grid">
          {roundResults.results.map((result) => (
            <div 
              key={result.playerId} 
              className={`answer-card ${
                result.scored ? 'answer-majority' : 
                result.gotPinkCow ? 'answer-unique' : 
                'answer-normal'
              }`}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                {result.playerName}
              </div>
              <div style={{ fontSize: '1.2rem', margin: '10px 0' }}>
                {result.answer}
              </div>
              <div>
                {result.scored && '✅ +1 punto'}
                {result.gotPinkCow && '🌸 Vaca Rosa'}
                {!result.scored && !result.gotPinkCow && '-'}
              </div>
            </div>
          ))}
        </div>

        <div className="players-list" style={{ marginTop: '30px' }}>
          <h3>Puntuación Actual</h3>
          {roundResults.players
            .sort((a, b) => b.score - a.score)
            .map((player) => (
              <div key={player.id} className="player-item">
                <span className="player-name">
                  {player.name}
                  {player.id === playerId && ' (Tú)'}
                </span>
                <span className="player-score">
                  <span className="cow-icon">🐄</span>
                  {player.score}
                  {player.hasPinkCow && <span className="pink-cow">🌸</span>}
                </span>
              </div>
            ))}
        </div>

        {isHost && (
          <button className="btn btn-primary" onClick={nextRound}>
            Siguiente Ronda
          </button>
        )}

        {!isHost && (
          <p className="game-status">Esperando que el anfitrión inicie la siguiente ronda...</p>
        )}
      </div>
    );
  }

  // Renderizado de juego finalizado
  if (gameState === 'finished') {
    return (
      <div className="container">
        <h1 className="game-title">🎉 Juego Terminado 🎉</h1>

        <div className="winner-announcement">
          🏆 {winner.name} ha ganado! 🏆
        </div>

        <div className="players-list">
          <h3>Puntuación Final</h3>
          {players
            .sort((a, b) => b.score - a.score)
            .map((player) => (
              <div key={player.id} className="player-item">
                <span className="player-name">
                  {player.name}
                  {player.id === playerId && ' (Tú)'}
                </span>
                <span className="player-score">
                  <span className="cow-icon">🐄</span>
                  {player.score}
                  {player.hasPinkCow && <span className="pink-cow">🌸</span>}
                </span>
              </div>
            ))}
        </div>

        {isHost && (
          <>
            <button className="btn btn-primary" onClick={restartGame}>
              Jugar de Nuevo
            </button>
            <button className="btn btn-secondary" onClick={leaveLobby}>
              Salir
            </button>
          </>
        )}

        {!isHost && (
          <>
            <p className="game-status">Esperando que el anfitrión decida...</p>
            <button className="btn btn-secondary" onClick={leaveLobby}>
              Salir
            </button>
          </>
        )}
      </div>
    );
  }

  return <div className="loading">Cargando...</div>;
}

export default App;
