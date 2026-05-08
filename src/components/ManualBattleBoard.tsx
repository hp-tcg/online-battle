import React, { useState, useReducer, useEffect } from 'react';
import './ManualBattleBoard.css';
import { ArrowLeft, BookOpen, User, Maximize2, RotateCcw, RefreshCw, Layers, Paperclip } from 'lucide-react';
import { Card, Deck } from '../types';
import { gameReducer, initialState } from '../engine/GameReducer';
import { CardInstance, PlayerState } from '../engine/GameState';

interface ManualBattleBoardProps {
  onBack: () => void;
  deck?: Deck;
  allCards?: Card[];
  savedDecks?: Deck[];
}

const ManualBattleBoard: React.FC<ManualBattleBoardProps> = ({ onBack, deck, allCards = [], savedDecks = [] }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [selectedCard, setSelectedCard] = useState<{instance: CardInstance, location: string} | null>(null);
  const [showDeckTopCount, setShowDeckTopCount] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [attachMode, setAttachMode] = useState<CardInstance | null>(null);

  // Sync saved decks from local storage
  const [localSavedDecks, setLocalSavedDecks] = useState<Deck[]>(savedDecks);
  useEffect(() => {
    const stored = localStorage.getItem('hp-tcg-decks');
    if (stored) {
      setLocalSavedDecks(JSON.parse(stored));
    }
  }, [gameStarted]);

  const startGameWithDeck = (selectedDeck: Deck) => {
    if (allCards.length === 0) return;

    const playerDeckCards = selectedDeck.cardIds
      .map(id => allCards.find(c => c.cardNumber === id))
      .filter(Boolean) as Card[];
    
    const opponentDeck = localSavedDecks.length > 1 ? localSavedDecks[1] : selectedDeck;
    const opponentDeckCards = opponentDeck.cardIds
      .map(id => allCards.find(c => c.cardNumber === id))
      .filter(Boolean) as Card[];

    const playerPartner = allCards.find(c => c.cardNumber === selectedDeck.partnerId);
    const opponentPartner = allCards.find(c => c.cardNumber === opponentDeck.partnerId) || playerPartner;
    
    const playerMpCard = allCards.find(c => c.cardNumber === selectedDeck.mpCardId);
    const opponentMpCard = allCards.find(c => c.cardNumber === opponentDeck.mpCardId) || playerMpCard;

    if (!playerPartner) {
      alert("パートナーカードが設定されていません。");
      return;
    }

    dispatch({ 
      type: 'START_GAME', 
      playerDeck: playerDeckCards, 
      opponentDeck: opponentDeckCards,
      playerPartner: playerPartner,
      opponentPartner: opponentPartner as Card,
      playerMpCard,
      opponentMpCard
    });
    setGameStarted(true);
  };

  const handleMoveCard = (instanceId: string, from: string, to: string) => {
    if (to === 'mainField' && state.player.mainField.length >= 3) {
      alert("メインフィールドは3枚までです。");
      return;
    }
    if (to === 'supportField' && state.player.supportField.length >= 4) {
      alert("サポートフィールドは4枚までです。");
      return;
    }

    dispatch({ type: 'MANUAL_MOVE', playerId: 'player', instanceId, from, to });
    setSelectedCard(null);
  };

  const handleAttach = (parentInstanceId: string) => {
    if (!attachMode) return;
    dispatch({ type: 'ATTACH_CARD', playerId: 'player', instanceId: attachMode.instanceId, parentInstanceId });
    setAttachMode(null);
    setSelectedCard(null);
  };

  const promptOpenTopN = () => {
    const val = window.prompt("山札の上から何枚オープンしますか？", "3");
    if (val) {
      const n = parseInt(val);
      if (!isNaN(n)) setShowDeckTopCount(n);
    }
  };

  const renderCard = (instance: CardInstance, location: string, isOpponent: boolean = false, isAttached: boolean = false) => {
    const isLife = location === 'life';
    const isResting = !instance.isActive && !isLife;

    return (
      <div className="card-container-wrapper" key={instance.instanceId}>
        <div 
          className={`card-slot ${isResting ? 'resting' : ''} ${isAttached ? 'attached-card-offset' : ''}`}
          onClick={() => {
            if (isOpponent) return;
            if (attachMode) {
                const targetLocs = ['mainField', 'supportField', 'partner'];
                if (instance.instanceId !== attachMode.instanceId && targetLocs.includes(location)) {
                  handleAttach(instance.instanceId);
                }
            } else {
                setSelectedCard({ instance, location });
            }
          }}
        >
          {isLife ? (
             <div className="deck-back"></div>
          ) : (
             <>
               <img 
                 src={`/images/${instance.card.cardNumber.replace('/', '_')}.png`} 
                 alt={instance.card.cardName} 
                 className="card-image"
               />
               {isResting && <div className="resting-overlay">休息</div>}
             </>
          )}
          {instance.attachedItems.length > 0 && (
            <div className="attached-indicator"><Paperclip size={10}/></div>
          )}
        </div>
        {!isAttached && instance.attachedItems.map((att, idx) => (
            <div key={att.instanceId} className="attached-item-container" style={{ zIndex: idx + 1 }}>
                {renderCard(att, location, isOpponent, true)}
            </div>
        ))}
      </div>
    );
  };

  const renderPlayerSide = (player: PlayerState, isOpponent: boolean) => {
    const activeMP = player.mpField.filter(c => c.isActive);
    const restingMP = player.mpField.filter(c => !c.isActive);

    return (
      <div className={`board-side ${isOpponent ? 'opponent' : 'player'}`}>
        <div className="zone life-zone">
          <div className="zone-label">Life ({player.life.length})</div>
          <div className="life-overlap-container vertical">
            {player.life.map((instance, index) => (
              <div key={instance.instanceId} className="life-card-wrapper" style={{ position: 'absolute', top: `${index * 12}px`, zIndex: index }}>
                {renderCard(instance, 'life', isOpponent)}
              </div>
            ))}
          </div>
        </div>

        <div className="zone main-field-zone">
          <div className="zone-label">
            Main Field
            {!isOpponent && <button className="reset-all-btn" onClick={() => dispatch({ type: 'RESET_ALL_RESTED', playerId: 'player' })} title="Stand All"><RefreshCw size={10}/></button>}
          </div>
          <div className="slots">
            {player.mainField.map(inst => renderCard(inst, 'mainField', isOpponent))}
            {Array.from({ length: Math.max(0, 3 - player.mainField.length) }).map((_, i) => (
              <div key={`empty-main-${i}`} className="card-slot"></div>
            ))}
          </div>
        </div>

        <div className="zone partner-zone">
          <div className="zone-label">Partner</div>
          {player.partner ? (
            <div className="partner-container">
              {renderCard(player.partner, 'partner', isOpponent)}
              {!isOpponent && (
                <div className="partner-effect-toggle">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={player.isPartnerEffectUsed} 
                      onChange={() => dispatch({ type: 'TOGGLE_PARTNER_EFFECT', playerId: 'player' })}
                    />
                    <span>Effect Used</span>
                  </label>
                </div>
              )}
            </div>
          ) : <div className="card-slot"></div>}
        </div>

        <div className="zone deck-zone">
          <div className="zone-label">Deck ({player.deck.length})</div>
          <div className="card-slot deck-back" onClick={() => !isOpponent && dispatch({ type: 'DRAW_CARD', playerId: 'player' })}></div>
          {!isOpponent && (
            <div className="deck-controls-container">
              <div className="deck-main-actions">
                <button className="deck-control-btn primary" onClick={() => dispatch({ type: 'DRAW_CARD', playerId: 'player' })} title="Draw Card">Draw</button>
                <button className="deck-control-btn secondary" onClick={() => dispatch({ type: 'DRAW_FROM_BOTTOM', playerId: 'player' })} title="Draw from Bottom">Btm</button>
              </div>
              <div className="deck-utility-actions">
                <button className="deck-util-btn" onClick={() => promptOpenTopN()} title="Open Top N"><Layers size={14}/></button>
                <button className="deck-util-btn" onClick={() => dispatch({ type: 'SHUFFLE_DECK', playerId: 'player'})} title="Shuffle"><RefreshCw size={14}/></button>
                <button className="deck-util-btn" onClick={() => dispatch({ type: 'SETUP_LIFE', playerId: 'player'})} title="Setup Life (3)">3</button>
              </div>
            </div>
          )}
        </div>

        <div className="zone support-field-zone">
          <div className="zone-label">Support Field</div>
          <div className="slots">
            {player.supportField.map(inst => renderCard(inst, 'supportField', isOpponent))}
            {Array.from({ length: Math.max(0, 4 - player.supportField.length) }).map((_, i) => (
              <div key={`empty-supp-${i}`} className="card-slot"></div>
            ))}
          </div>
        </div>

        <div className="zone mp-field-zone">
          <div className="zone-label">MP ({player.mpField.length})</div>
          <div className="mp-split-container">
            <div className="mp-sub-zone active-mp">
              {activeMP.map((instance, index) => (
                <div key={instance.instanceId} className="mp-stacked-card" style={{ marginLeft: index === 0 ? 0 : '-40px', zIndex: index }}>
                  {renderCard(instance, 'mpField', isOpponent)}
                </div>
              ))}
            </div>
            <div className="mp-sub-zone resting-mp">
              {restingMP.map((instance, index) => (
                <div key={instance.instanceId} className="mp-stacked-card" style={{ marginLeft: index === 0 ? 0 : '-40px', zIndex: index }}>
                  {renderCard(instance, 'mpField', isOpponent)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="zone trash-zone">
          <div className="zone-label">Trash ({player.trash.length})</div>
          <div className="card-slot">
            {player.trash.length > 0 && renderCard(player.trash[player.trash.length - 1], 'trash', isOpponent)}
          </div>
        </div>

        {!isOpponent && (
          <div className="zone hand-zone">
            <div className="zone-label">Hand ({player.hand.length})</div>
            <div className="hand-overlap-container">
              {player.hand.map((instance, index) => {
                const overlap = player.hand.length > 12 ? (320 / player.hand.length) : 25;
                return (
                  <div key={instance.instanceId} style={{ position: 'absolute', left: `${index * overlap}px`, zIndex: index }}>
                    {renderCard(instance, 'hand', isOpponent)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!gameStarted) {
    return (
      <div className="manual-battle-container">
        <div className="board-header">
          <button className="back-btn" onClick={onBack}><ArrowLeft size={14} /> Exit</button>
          <div className="board-title">Select Deck to Start</div>
        </div>
        <div className="deck-selection-screen">
          <div className="selection-grid">
            {localSavedDecks.map(d => (
              <div key={d.name} className="deck-select-card" onClick={() => startGameWithDeck(d)}>
                <BookOpen size={32} />
                <h3>{d.name}</h3>
                <p>{d.cardIds.length} cards</p>
                <div className="deck-select-meta">
                   {d.partnerId && <span><User size={12}/> {allCards.find(c => c.cardNumber === d.partnerId)?.cardName}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="manual-battle-container">
      {attachMode && (
          <div className="attach-banner">装備先のカードをクリックしてください（Main/Support/Partner） <button onClick={() => setAttachMode(null)}>キャンセル</button></div>
      )}
      <div className="board-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14} /> Exit</button>
        <div className="board-title">Manual Duel Simulator</div>
        <div className="game-info"><span>Turn {state.turnCount}</span><span>{state.phase}</span></div>
        <button className="back-btn" onClick={() => dispatch({ type: 'NEXT_PHASE' })}>Next Phase</button>
      </div>
      <div className="battle-area">
        {renderPlayerSide(state.opponent, true)}
        <div className="center-divider"></div>
        {renderPlayerSide(state.player, false)}
      </div>
      {selectedCard && (
        <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
            <div className="detail-layout">
              <div className="detail-image-container">
                <img src={`/images/${selectedCard.instance.card.cardNumber.replace('/', '_')}.png`} alt={selectedCard.instance.card.cardName} className="detail-image" />
              </div>
              <div className="detail-info">
                <h3>{selectedCard.instance.card.cardName}</h3>
                <p className="card-no">{selectedCard.instance.card.cardNumber}</p>
                {selectedCard.location !== 'hand' && (
                  <div className="action-group">
                    <h4>State</h4>
                    <div className="action-buttons-row">
                      <button className="action-btn-large" onClick={() => dispatch({ type: 'ACTIVATE_CARD', playerId: 'player', instanceId: selectedCard.instance.instanceId })}><Maximize2 size={16} /> Stand</button>
                      <button className="action-btn-large" onClick={() => { dispatch({ type: 'REST_CARD', playerId: 'player', instanceId: selectedCard.instance.instanceId }); setSelectedCard(null); }}><RotateCcw size={16} /> Resting (休息)</button>
                    </div>
                  </div>
                )}
                <div className="action-group">
                  <h4>Actions</h4>
                  <div className="move-buttons-grid">
                    <button onClick={() => { setAttachMode(selectedCard.instance); setSelectedCard(null); }}><Paperclip size={14}/> 装備する</button>
                    {selectedCard.location !== 'partner' && (
                      <>
                        <button onClick={() => handleMoveCard(selectedCard.instance.instanceId, selectedCard.location, 'hand')}>Hand</button>
                        <button onClick={() => handleMoveCard(selectedCard.instance.instanceId, selectedCard.location, 'mainField')}>Main</button>
                        <button onClick={() => handleMoveCard(selectedCard.instance.instanceId, selectedCard.location, 'supportField')}>Support</button>
                        <button onClick={() => handleMoveCard(selectedCard.instance.instanceId, selectedCard.location, 'mpField')}>MP</button>
                        <button onClick={() => handleMoveCard(selectedCard.instance.instanceId, selectedCard.location, 'trash')}>Trash</button>
                        <button onClick={() => handleMoveCard(selectedCard.instance.instanceId, selectedCard.location, 'deckTop')}>Deck Top</button>
                        <button onClick={() => handleMoveCard(selectedCard.instance.instanceId, selectedCard.location, 'deckBottom')}>Deck Bottom</button>
                      </>
                    )}
                  </div>
                </div>
                <button className="close-btn-full" onClick={() => setSelectedCard(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDeckTopCount !== null && (
        <div className="modal-overlay" onClick={() => setShowDeckTopCount(null)}>
          <div className="modal-content deck-open-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{textAlign: 'center', marginBottom: '10px'}}>Deck Top (Showing {Math.min(showDeckTopCount, state.player.deck.length)} cards)</h3>
            <div className="deck-top-grid">
              {state.player.deck.slice(0, showDeckTopCount).map((card, idx) => (
                <div key={idx} className="deck-top-item">
                  <div className="card-slot small"><img src={`/images/${card.cardNumber.replace('/', '_')}.png`} alt={card.cardName} className="card-image" /></div>
                  <div className="deck-top-actions">
                    <button onClick={() => { dispatch({ type: 'MANUAL_MOVE', playerId: 'player', from: 'deck', to: 'hand', index: idx }); setShowDeckTopCount(prev => prev ? prev - 1 : 0); }}>Hand</button>
                    <button onClick={() => { dispatch({ type: 'MANUAL_MOVE', playerId: 'player', from: 'deck', to: 'deckTop', index: idx }); setShowDeckTopCount(prev => prev ? prev - 1 : 0); }}>Top</button>
                    <button onClick={() => { if (state.player.mainField.length >= 3) { alert("メインフィールドは3枚までです。"); return; } dispatch({ type: 'MANUAL_MOVE', playerId: 'player', from: 'deck', to: 'mainField', index: idx }); setShowDeckTopCount(prev => prev ? prev - 1 : 0); }}>Main</button>
                    <button onClick={() => { dispatch({ type: 'MANUAL_MOVE', playerId: 'player', from: 'deck', to: 'trash', index: idx }); setShowDeckTopCount(prev => prev ? prev - 1 : 0); }}>Trash</button>
                    <button onClick={() => { dispatch({ type: 'MANUAL_MOVE', playerId: 'player', from: 'deck', to: 'deckBottom', index: idx }); setShowDeckTopCount(prev => prev ? prev - 1 : 0); }}>Bottom</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="close-btn" onClick={() => setShowDeckTopCount(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualBattleBoard;
