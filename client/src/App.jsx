import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('menu'); // menu, lobby, choosing_question, answering, voting, results, finished
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionOptions, setQuestionOptions] = useState([]);
  const [cowboyId, setCowboyId] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerProgress, setAnswerProgress] = useState({ submitted: 0, total: 0 });
  const [allAnswers, setAllAnswers] = useState([]);
  const [selectedVotes, setSelectedVotes] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [votingProgress, setVotingProgress] = useState({ voted: 0, total: 0 });
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
      setCowboyId(data.cowboyId);
      
      // Restaurar estado del juego
      if (data.lobby.gameState === 'choosing_question') {
        setGameState('choosing_question');
        setQuestionOptions(data.lobby.questionOptions || []);
      } else if (data.lobby.gameState === 'answering') {
        setGameState('answering');
        const hasPlayerAnswered = data.lobby.answers.some(a => a.playerId === data.playerId);
        setHasAnswered(hasPlayerAnswered);
        setAnswerProgress({
          submitted: data.lobby.answers.length,
          total: data.lobby.players.length
        });
      } else if (data.lobby.gameState === 'voting') {
        setGameState('voting');
        setAllAnswers(data.lobby.answers || []);
        const hasPlayerVoted = data.lobby.votes && data.lobby.votes.some(v => v.playerId === data.playerId);
        setHasVoted(hasPlayerVoted);
        setVotingProgress({
          voted: data.lobby.votes ? data.lobby.votes.length : 0,
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
      setGameState(data.gameState);
      setCurrentRound(data.currentRound);
      setCowboyId(data.cowboyId);
      setQuestionOptions(data.questionOptions);
      setPlayers(data.players);
      setHasAnswered(false);
      setAnswer('');
      setHasVoted(false);
      setSelectedVotes([]);
    });

    socket.on('questionSelected', (data) => {
      setGameState(data.gameState);
      setCurrentQuestion(data.question);
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

    socket.on('startVoting', (data) => {
      setGameState(data.gameState);
      setAllAnswers(data.answers);
      setHasVoted(false);
      setSelectedVotes([playerId]); // Auto-votar por uno mismo
      setVotingProgress({ voted: 0, total: players.length });
    });

    socket.on('votesSubmitted', () => {
      setHasVoted(true);
    });

    socket.on('votingProgress', (data) => {
      setVotingProgress({ voted: data.votedCount, total: data.totalPlayers });
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
      setCurrentRound(data.currentRound);
      setCurrentQuestion('');
      setQuestionOptions(data.questionOptions);
      setCowboyId(data.cowboyId);
      setPlayers(data.players);
      setHasAnswered(false);
      setAnswer('');
      setHasVoted(false);
      setSelectedVotes([]);
      setAllAnswers([]);
      setRoundResults(null);
      setGameState(data.gameState);
      setAnswerProgress({ submitted: 0, total: data.players.length });
      setVotingProgress({ voted: 0, total: data.players.length });
    });

    socket.on('gameRestarted', () => {
      setGameState('lobby');
      setCurrentRound(0);
      setCurrentQuestion('');
      setQuestionOptions([]);
      setAnswer('');
      setHasAnswered(false);
      setHasVoted(false);
      setSelectedVotes([]);
      setAllAnswers([]);
      setRoundResults(null);
      setWinner(null);
    });

    socket.on('gameLeft', () => {
      localStorage.removeItem('menteVacunaSession');
      setGameState('menu');
      setLobbyCode('');
      setPlayerId('');
      setPlayers([]);
    });

    socket.on('playerLeft', (data) => {
      // Actualizar lista de jugadores cuando alguien se va
      setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== data.playerId));
      
      // Si el nuevo host soy yo, actualizar
      if (data.newHost === playerId) {
        setIsHost(true);
      }
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
      socket.off('questionSelected');
      socket.off('answerSubmitted');
      socket.off('answerProgress');
      socket.off('startVoting');
      socket.off('votesSubmitted');
      socket.off('votingProgress');
      socket.off('roundComplete');
      socket.off('newRound');
      socket.off('gameRestarted');
      socket.off('gameLeft');
      socket.off('playerLeft');
      socket.off('error');
    };
  }, [socket, playerId, players.length]);

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

  const selectQuestion = (index) => {
    socket.emit('selectQuestion', { lobbyCode, playerId, selectedIndex: index });
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

  const toggleVote = (votedPlayerId) => {
    if (votedPlayerId === playerId) return; // No puede desvotarse a sí mismo
    
    setSelectedVotes(prev => {
      if (prev.includes(votedPlayerId)) {
        return prev.filter(id => id !== votedPlayerId);
      } else {
        return [...prev, votedPlayerId];
      }
    });
  };

  const submitVotes = () => {
    socket.emit('submitVotes', { 
      lobbyCode, 
      playerId, 
      votedPlayerIds: selectedVotes 
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

  const leaveGame = () => {
    if (confirm('¿Estás seguro de que quieres abandonar el juego? Perderás todo tu progreso.')) {
      socket.emit('leaveGame', { lobbyCode, playerId });
    }
  };

  const getCowboyName = () => {
    const cowboy = players.find(p => p.id === cowboyId);
    return cowboy ? cowboy.name : '';
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
            <li>El Vaquero elige la pregunta entre 2 opciones</li>
            <li>Todos responden en secreto</li>
            <li>Votan por quiénes respondieron igual</li>
            <li>El grupo mayoritario gana 1 punto</li>
            <li>Si nadie vota que eres igual, recibes la vaca rosa 🌸</li>
            <li>Para ganar necesitas 8 puntos SIN la vaca rosa</li>
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

  // Renderizado de selección de pregunta (vaquero)
  if (gameState === 'choosing_question') {
    const isCowboy = cowboyId === playerId;

    return (
      <div className="container">
        <h1 className="game-title">🐮 Mente Vacuna 🐮</h1>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div><strong>Ronda:</strong> {currentRound}</div>
          <div><strong>Vaquero:</strong> 🤠 {getCowboyName()}</div>
        </div>

        <div className="players-list">
          {players.map((player) => (
            <div key={player.id} className="player-item">
              <span className="player-name">
                {player.id === cowboyId && '🤠 '}
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

        {isCowboy ? (
          <>
            <h2 style={{ textAlign: 'center', margin: '30px 0' }}>
              Elige una pregunta:
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {questionOptions.map((question, index) => (
                <button
                  key={index}
                  className="btn btn-primary"
                  onClick={() => selectQuestion(index)}
                  style={{ padding: '30px', fontSize: '1.2rem', whiteSpace: 'normal', height: 'auto' }}
                >
                  {question}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="game-status">
            🤠 {getCowboyName()} está eligiendo la pregunta...
          </div>
        )}

        <button className="btn btn-secondary" onClick={leaveGame} style={{ marginTop: '20px' }}>
          Abandonar Juego
        </button>
      </div>
    );
  }

  // Renderizado del juego (responder)
  if (gameState === 'answering') {
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

        <button className="btn btn-secondary" onClick={leaveGame} style={{ marginTop: '20px' }}>
          Abandonar Juego
        </button>
      </div>
    );
  }

  // Renderizado de votación
  if (gameState === 'voting') {
    const myAnswer = allAnswers.find(a => a.playerId === playerId);

    return (
      <div className="container">
        <h1 className="game-title">🗳️ Votación</h1>

        <div className="game-status">
          Tu respuesta: <strong>{myAnswer?.answer}</strong>
        </div>

        <p style={{ textAlign: 'center', margin: '20px 0', fontSize: '1.1rem' }}>
          Vota por todos los que respondieron <strong>igual que tú</strong>:
        </p>

        {!hasVoted ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              {allAnswers.map((answerData) => {
                const isMe = answerData.playerId === playerId;
                const isSelected = selectedVotes.includes(answerData.playerId);

                return (
                  <div
                    key={answerData.playerId}
                    className="answer-card"
                    style={{
                      backgroundColor: isMe ? '#e3f2fd' : isSelected ? '#c8e6c9' : '#f5f5f5',
                      border: isMe ? '3px solid #2196f3' : isSelected ? '3px solid #4caf50' : '2px solid #ddd',
                      padding: '20px',
                      marginBottom: '15px',
                      cursor: isMe ? 'default' : 'pointer',
                      borderRadius: '10px'
                    }}
                    onClick={() => !isMe && toggleVote(answerData.playerId)}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '1.1rem' }}>
                      {answerData.playerName} {isMe && '(Tú)'}
                    </div>
                    <div style={{ fontSize: '1.3rem', color: '#333' }}>
                      {answerData.answer}
                    </div>
                    {isSelected && !isMe && (
                      <div style={{ marginTop: '10px', color: '#4caf50', fontWeight: 'bold' }}>
                        ✓ Votado
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', marginBottom: '15px', color: '#666' }}>
              Has votado por {selectedVotes.length} jugador{selectedVotes.length !== 1 && 'es'}
            </div>

            <button className="btn btn-primary" onClick={submitVotes}>
              Confirmar Votos
            </button>
          </>
        ) : (
          <div className="game-status">
            ✅ Votos enviados. Esperando a los demás...
            <div style={{ marginTop: '10px' }}>
              {votingProgress.voted} / {votingProgress.total} jugadores han votado
            </div>
          </div>
        )}

        <button className="btn btn-secondary" onClick={leaveGame} style={{ marginTop: '20px' }}>
          Abandonar Juego
        </button>
      </div>
    );
  }

  // Renderizado de resultados
  if (gameState === 'results') {
    return (
      <div className="container">
        <h1 className="game-title">📊 Resultados de la Ronda {currentRound}</h1>

        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>Respuestas y Resultados:</h3>
          {roundResults.results.map((result) => (
            <div 
              key={result.playerId} 
              className={`answer-card ${
                result.scored ? 'answer-majority' : 
                result.gotPinkCow ? 'answer-unique' : 
                'answer-normal'
              }`}
              style={{ marginBottom: '15px' }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '1.1rem' }}>
                {result.playerName}
              </div>
              <div style={{ fontSize: '1.2rem', margin: '10px 0' }}>
                "{result.answer}"
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                Grupo de {result.groupSize} jugador{result.groupSize !== 1 && 'es'}
              </div>
              <div style={{ marginTop: '10px', fontWeight: 'bold' }}>
                {result.scored && '✅ +1 punto (mayoría)'}
                {result.gotPinkCow && '🌸 Vaca Rosa (único)'}
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

        <button className="btn btn-secondary" onClick={leaveGame} style={{ marginTop: '10px' }}>
          Abandonar Juego
        </button>
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
