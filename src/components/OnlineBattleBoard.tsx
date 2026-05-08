import React, { useState, useReducer, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { ArrowLeft, BookOpen, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { Card, Deck } from '../types';
import { gameReducer, initialState } from '../engine/GameReducer';
import { GameAction } from '../engine/GameState';
import ManualBattleBoard from './ManualBattleBoard';

interface OnlineBattleBoardProps {
  onBack: () => void;
  allCards: Card[];
  savedDecks: Deck[];
}

type ConnectionState = 'IDLE' | 'HOSTING' | 'JOINING' | 'CONNECTED' | 'DISCONNECTED';

const OnlineBattleBoard: React.FC<OnlineBattleBoardProps> = ({ onBack, allCards, savedDecks }) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);

  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentDeck, setOpponentDeck] = useState<Deck | null>(null);

  useEffect(() => {
    const newPeer = new Peer();
    newPeer.on('open', (id) => setPeerId(id));
    newPeer.on('connection', (c) => {
      if (isHost) {
        setConn(c);
        setConnectionState('CONNECTED');
      }
    });
    setPeer(newPeer);
    return () => newPeer.destroy();
  }, [isHost]);

  useEffect(() => {
    if (!conn) return;
    conn.on('data', (data: any) => {
      const message = data as { type: string; payload: any };
      if (message.type === 'ACTION') {
        const action = message.payload as GameAction;
        let flippedAction: GameAction = action;

        if (action.type === 'START_GAME') {
          flippedAction = {
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
        } else if ('playerId' in action) {
          flippedAction = { ...action, playerId: (action as any).playerId === 'player' ? 'opponent' : 'player' } as any;
        }

        dispatch(flippedAction);

        // Guest automatically starts game upon receiving START_GAME
        if (action.type === 'START_GAME' && !isHost) {
          setGameStarted(true);
        }
      } else if (message.type === 'READY') {
        setOpponentDeck(message.payload.deck);
        setOpponentReady(true);
      }
    });
    conn.on('close', () => setConnectionState('DISCONNECTED'));
  }, [conn, isHost]);

  const hostGame = () => { setIsHost(true); setConnectionState('HOSTING'); };
  const joinGame = () => {
    if (!peer || !remotePeerId) return;
    const c = peer.connect(remotePeerId);
    c.on('open', () => {
        setConn(c);
        setIsHost(false);
        setConnectionState('CONNECTED');
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
  };

  useEffect(() => {
    if (selectedDeck && opponentDeck && opponentReady && connectionState === 'CONNECTED' && !gameStarted && isHost) {
      const shuffle = (array: any[]) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
      };

      const pDeckCards = shuffle(selectedDeck.cardIds.map(id => allCards.find(c => c.cardNumber === id)).filter(Boolean) as Card[]);
      const oDeckCards = shuffle(opponentDeck.cardIds.map(id => allCards.find(c => c.cardNumber === id)).filter(Boolean) as Card[]);
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
  }, [selectedDeck, opponentDeck, opponentReady, connectionState, isHost, gameStarted]);

  useEffect(() => {
    if (!isHost && state.turnCount > 0 && !gameStarted) setGameStarted(true);
  }, [state.turnCount, isHost, gameStarted]);

  const onSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck);
    if (conn) conn.send({ type: 'READY', payload: { deck } });
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
        {connectionState === 'IDLE' && (
          <div className="lobby-actions">
            <button className="lobby-btn host" onClick={hostGame}><LinkIcon size={24} /><span>Host Game</span></button>
            <div className="lobby-divider">OR</div>
            <div className="join-group">
              <input type="text" placeholder="Enter Host ID..." value={remotePeerId} onChange={e => setRemotePeerId(e.target.value)} />
              <button className="lobby-btn join" onClick={joinGame}>Join Game</button>
            </div>
          </div>
        )}
        {connectionState === 'HOSTING' && (
          <div className="hosting-info">
            <h3>Waiting for opponent...</h3>
            <div className="id-display"><code>{peerId}</code><button onClick={copyToClipboard}>{copied ? <Check size={16} color="green" /> : <Copy size={16} />}</button></div>
          </div>
        )}
        {connectionState === 'CONNECTED' && (
          <div className="deck-selection-screen">
            <h2>Select Your Deck</h2>
            <div className="selection-grid">
              {savedDecks.map(d => (
                <div key={d.name} className={`deck-select-card ${selectedDeck?.name === d.name ? 'selected' : ''}`} onClick={() => onSelectDeck(d)}>
                  <BookOpen size={32} /><h3>{d.name}</h3><p>{d.cardIds.length} cards</p>
                </div>
              ))}
            </div>
            {selectedDeck && <div className="waiting-msg">{opponentReady ? 'Opponent is ready! Starting...' : 'Waiting for opponent to select deck...'}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineBattleBoard;
