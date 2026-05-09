import React, { useState, useReducer, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { ArrowLeft, BookOpen, Copy, Check, Link as LinkIcon, Upload } from 'lucide-react';
import { Card, Deck } from '../types';
import { gameReducer, initialState } from '../engine/GameReducer';
import { GameAction } from '../engine/GameState';
import ManualBattleBoard from './ManualBattleBoard';

interface OnlineBattleBoardProps {
  onBack: () => void;
  allCards: Card[];
  savedDecks: Deck[];
}

type ConnectionState = 'IDLE' | 'HOSTING' | 'JOINING' | 'CONNECTED' | 'DISCONNECTED' | 'SPECTATING';

const OnlineBattleBoard: React.FC<OnlineBattleBoardProps> = ({ onBack, allCards, savedDecks }) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [spectators, setSpectators] = useState<DataConnection[]>([]);
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
  const [isHost, setIsHost] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [copied, setCopied] = useState(false);

  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentDeck, setOpponentDeck] = useState<Deck | null>(null);
  const [localSavedDecks, setLocalSavedDecks] = useState<Deck[]>(savedDecks);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  const spectatorsRef = useRef(spectators);
  const isHostRef = useRef(isHost);
  const isSpectatorRef = useRef(isSpectator);
  const gameStartedRef = useRef(gameStarted);
  const connRef = useRef<DataConnection | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { spectatorsRef.current = spectators; }, [spectators]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { isSpectatorRef.current = isSpectator; }, [isSpectator]);
  useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);
  useEffect(() => { connRef.current = conn; }, [conn]);

  useEffect(() => {
    setLocalSavedDecks(savedDecks);
  }, [savedDecks]);

  const handleData = (data: any, fromConn: DataConnection) => {
    const message = data as { type: string; payload: any };
    if (message.type === 'ACTION') {
      const action = message.payload as GameAction;
      let processedAction: GameAction = action;

      const isReceivedFromOpponent = !isSpectatorRef.current && fromConn === connRef.current;
      
      if (isReceivedFromOpponent) {
        if (action.type === 'START_GAME') {
          processedAction = {
            ...action,
            playerDeck: action.opponentDeck,
            opponentDeck: action.playerDeck,
            playerPartner: action.opponentPartner,
            opponentPartner: action.playerPartner,
            playerMpCard: action.opponentMpCard,
            opponentMpCard: action.playerMpCard,
            playerPartnerId: action.opponentPartnerId,
            opponentPartnerId: action.playerPartnerId,
            playerMpCardId: action.opponentMpCardId,
            opponentMpCardId: action.playerMpCardId,
          };
        } else if (action.type === 'SET_STATE') {
          processedAction = {
            type: 'SET_STATE',
            state: {
              ...action.state,
              player: action.state.opponent,
              opponent: action.state.player,
              turnOwner: action.state.turnOwner === 'player' ? 'opponent' : 'player',
              activeSearch: action.state.activeSearch ? {
                ...action.state.activeSearch,
                playerId: action.state.activeSearch.playerId === 'player' ? 'opponent' : 'player'
              } : null
            }
          };
        } else if ('playerId' in action) {
          processedAction = { ...action, playerId: (action as any).playerId === 'player' ? 'opponent' : 'player' } as any;
        }
      }

      dispatch(processedAction);

      if (isHostRef.current) {
        let broadcastAction = action;
        if (fromConn === connRef.current) {
            broadcastAction = processedAction;
        }
        spectatorsRef.current.forEach(s => s.send({ type: 'ACTION', payload: broadcastAction }));
      }

      if (action.type === 'START_GAME' && !gameStartedRef.current) {
        setGameStarted(true);
      }
    } else if (message.type === 'READY') {
      setOpponentDeck(message.payload.deck);
      setOpponentReady(true);
    } else if (message.type === 'ERROR') {
      alert(message.payload);
      setConnectionState('IDLE');
    }
  };

  useEffect(() => {
    const newPeer = new Peer();
    
    newPeer.on('open', (id) => {
      setPeerId(id);
    });

    newPeer.on('connection', (c) => {
      c.on('open', () => {
        c.on('data', (data: any) => {
          if (data && data.type === 'JOIN_TYPE') {
            if (data.payload === 'PLAYER') {
              if (isHostRef.current && !connRef.current) {
                setConn(c);
                setConnectionState('CONNECTED');
                c.on('data', (d) => handleData(d, c));
              } else if (isHostRef.current) {
                c.send({ type: 'ERROR', payload: '対戦相手が既に存在します。観戦モードで参加してください。' });
                setTimeout(() => c.close(), 500);
              }
            } else if (data.payload === 'SPECTATOR') {
              setSpectators(prev => [...prev, c]);
              if (gameStartedRef.current || stateRef.current.turnCount > 0 || stateRef.current.player.partner) {
                c.send({ type: 'ACTION', payload: { type: 'SET_STATE', state: stateRef.current } });
              }
              c.on('data', (d) => handleData(d, c));
            }
          }
        });
      });

      c.on('close', () => {
        setSpectators(prev => prev.filter(s => s !== c));
        if (c === connRef.current) {
            setConn(null);
            if (isHostRef.current) setConnectionState('HOSTING');
            else setConnectionState('DISCONNECTED');
        }
      });
    });

    setPeer(newPeer);

    return () => {
      newPeer.destroy();
    };
  }, []);

  const hostGame = () => { 
    setIsHost(true); 
    setConnectionState('HOSTING'); 
  };
  
  const joinGame = (asSpectator: boolean = false) => {
    if (!peer || !remotePeerId) return;
    const c = peer.connect(remotePeerId);
    
    c.on('open', () => {
        setConn(c);
        setIsHost(false);
        setIsSpectator(asSpectator);
        setConnectionState(asSpectator ? 'SPECTATING' : 'CONNECTED');
        c.send({ type: 'JOIN_TYPE', payload: asSpectator ? 'SPECTATOR' : 'PLAYER' });
        c.on('data', (d) => handleData(d, c));
    });

    c.on('error', (err) => {
        console.error('Connection error:', err);
        alert('接続に失敗しました。IDを確認してください。');
        setConnectionState('IDLE');
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (action: GameAction) => {
    dispatch(action);
    if (conn) conn.send({ type: 'ACTION', payload: action });
    if (isHost) {
      spectators.forEach(s => s.send({ type: 'ACTION', payload: action }));
    }
  };

  useEffect(() => {
    if (selectedDeck && opponentDeck && opponentReady && connectionState === 'CONNECTED' && !gameStarted && isHost) {
      const shuffleDeck = (array: any[]) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
      };

      const pDeckCards = shuffleDeck(selectedDeck.cardIds.map(id => allCards.find(c => c.cardNumber === id)).filter(Boolean) as Card[]);
      const oDeckCards = shuffleDeck(opponentDeck.cardIds.map(id => allCards.find(c => c.cardNumber === id)).filter(Boolean) as Card[]);
      const pPartner = allCards.find(c => c.cardNumber === selectedDeck.partnerId)!;
      const oPartner = allCards.find(c => c.cardNumber === opponentDeck.partnerId)!;
      const pMp = allCards.find(c => c.cardNumber === selectedDeck.mpCardId);
      const oMp = allCards.find(c => c.cardNumber === opponentDeck.mpCardId);

      handleAction({
        type: 'START_GAME',
        playerDeck: pDeckCards,
        opponentDeck: oDeckCards,
        playerPartner: pPartner,
        opponentPartner: oPartner,
        playerMpCard: pMp,
        opponentMpCard: oMp,
        playerPartnerId: Math.random().toString(36).substr(2, 9),
        opponentPartnerId: Math.random().toString(36).substr(2, 9),
        playerMpCardId: pMp ? Math.random().toString(36).substr(2, 9) : undefined,
        opponentMpCardId: oMp ? Math.random().toString(36).substr(2, 9) : undefined,
      });

      setGameStarted(true);
    }
  }, [selectedDeck, opponentDeck, opponentReady, connectionState, isHost, gameStarted, allCards]);

  useEffect(() => {
    if (!isHost && !isSpectator && state.turnCount > 0 && !gameStarted) setGameStarted(true);
    if (isSpectator && (state.turnCount > 0 || state.player.partner) && !gameStarted) setGameStarted(true);
  }, [state.turnCount, state.player.partner, isHost, isSpectator, gameStarted]);

  const onSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck);
    if (conn) conn.send({ type: 'READY', payload: { deck } });
  };

  const importDeck = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = event.target.files?.[0];
    if (!file) return;

    fileReader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const importedDecks: Deck[] = Array.isArray(data) ? data : [data];
        const validDecks = importedDecks.filter(d => d && d.cardIds && d.partnerId && d.mpCardId && d.name);

        if (validDecks.length > 0) {
          setLocalSavedDecks(prev => {
            const next = [...prev];
            validDecks.forEach(deck => {
              const existingIndex = next.findIndex(d => d.name === deck.name);
              if (existingIndex > -1) { next[existingIndex] = deck; } else { next.push(deck); }
            });
            return next;
          });
          if (validDecks.length === 1) { onSelectDeck(validDecks[0]); }
          alert(`${validDecks.length}個のデッキを読み込みました。`);
        } else {
          alert('有効なデッキデータが見つかりませんでした。');
        }
      } catch (err) {
        console.error('Failed to import deck:', err);
        alert('インポートに失敗しました。');
      }
    };
    fileReader.readAsText(file);
  };

  if (gameStarted) {
    return (
      <ManualBattleBoard 
        onBack={onBack} 
        allCards={allCards} 
        externalState={state} 
        externalDispatch={handleAction}
        isOnline={true}
        isHost={isHost}
        isSpectator={isSpectator}
      />
    );
  }

  return (
    <div className="online-battle-lobby">
      <div className="board-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <div className="board-title">Online Battle Lobby</div>
      </div>
      <div className="lobby-content">
        {(connectionState === 'IDLE' || connectionState === 'DISCONNECTED') && (
          <div className="lobby-actions">
            <button className="lobby-btn host" onClick={hostGame}><LinkIcon size={24} /><span>Host Game</span></button>
            <div className="lobby-divider">OR</div>
            <div className="join-group">
              <input type="text" placeholder="Enter Host ID..." value={remotePeerId} onChange={e => setRemotePeerId(e.target.value)} />
              <div className="join-buttons">
                <button className="lobby-btn join" onClick={() => joinGame(false)}>Join Game</button>
                <button className="lobby-btn spectate" onClick={() => joinGame(true)}>Spectate</button>
              </div>
            </div>
          </div>
        )}
        {connectionState === 'HOSTING' && (
          <div className="hosting-info">
            <h3>Waiting for opponent...</h3>
            <div className="id-display"><code>{peerId}</code><button onClick={copyToClipboard}>{copied ? <Check size={16} color="green" /> : <Copy size={16} />}</button></div>
            {spectators.length > 0 && <div className="spectator-count">Spectators: {spectators.length}</div>}
          </div>
        )}
        {connectionState === 'CONNECTED' && (
          <div className="deck-selection-screen">
            <div className="selection-header">
              <h2>Select Your Deck</h2>
              <button className="import-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} /> Import Deck
                <input type="file" ref={fileInputRef} onChange={importDeck} style={{display: 'none'}} accept=".json" />
              </button>
            </div>
            <div className="selection-grid">
              {localSavedDecks.map(d => (
                <div key={d.name} className={`deck-select-card ${selectedDeck?.name === d.name ? 'selected' : ''}`} onClick={() => onSelectDeck(d)}>
                  <BookOpen size={32} /><h3>{d.name}</h3><p>{d.cardIds.length} cards</p>
                </div>
              ))}
            </div>
            {selectedDeck && <div className="waiting-msg">{opponentReady ? 'Opponent is ready! Starting...' : 'Waiting for opponent to select deck...'}</div>}
            {spectators.length > 0 && <div className="spectator-count">Spectators: {spectators.length}</div>}
          </div>
        )}
        {connectionState === 'SPECTATING' && (
          <div className="spectating-info">
            <h3>Joined as Spectator</h3>
            <p>Waiting for game to start...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineBattleBoard;
