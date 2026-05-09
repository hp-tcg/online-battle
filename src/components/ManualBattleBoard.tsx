import React, { useState, useReducer, useEffect } from 'react';
import './ManualBattleBoard.css';
import { ArrowLeft, BookOpen, User, RefreshCw, Paperclip, Save, Trash2 } from 'lucide-react';
import { Card, Deck } from '../types';
import { gameReducer, initialState } from '../engine/GameReducer';
import { CardInstance, PlayerState, GameState, GameAction } from '../engine/GameState';

interface ManualBattleBoardProps {
  onBack: () => void;
  deck?: Deck;
  allCards?: Card[];
  savedDecks?: Deck[];
  externalState?: GameState;
  externalDispatch?: (action: GameAction) => void;
  isOnline?: boolean;
  isHost?: boolean;
  isSpectator?: boolean;
}

const ManualBattleBoard: React.FC<ManualBattleBoardProps> = ({ 
  onBack, deck, allCards = [], savedDecks = [], 
  externalState, externalDispatch, isOnline = false, isHost = false, isSpectator = false
}) => {
  const [internalState, internalDispatch] = useReducer(gameReducer, initialState);
  
  const state = externalState || internalState;
  const dispatch = (action: GameAction) => {
      if (isSpectator) return;
      if (externalDispatch) {
          externalDispatch(action);
      } else {
          internalDispatch(action);
      }
  };

  const [selectedCard, setSelectedCard] = useState<{instance: CardInstance, location: string, isOpponent?: boolean} | null>(null);
  const [viewingTrash, setViewingTrash] = useState<'player' | 'opponent' | null>(null);
  const [gameStarted, setGameStarted] = useState(isOnline || !!deck);
  const [attachMode, setAttachMode] = useState<CardInstance | null>(null);
  const [savedGame, setSavedGame] = useState<GameState | null>(null);

  const [localSavedDecks, setLocalSavedDecks] = useState<Deck[]>(savedDecks);
  
  useEffect(() => {
    const storedDecks = localStorage.getItem('hp-tcg-decks');
    if (storedDecks) {
      setLocalSavedDecks(JSON.parse(storedDecks));
    }

    const storedGame = localStorage.getItem('hp-tcg-save-game');
    if (storedGame) {
      try {
        setSavedGame(JSON.parse(storedGame));
      } catch (e) {
        console.error("Failed to load saved game", e);
      }
    }
  }, [gameStarted]);

  useEffect(() => {
    if (gameStarted && !isOnline && !externalState) {
      localStorage.setItem('hp-tcg-save-game', JSON.stringify(state));
    }
  }, [state, gameStarted, isOnline, externalState]);

  const startGameWithDeck = (selectedDeck: Deck) => {
    if (allCards.length === 0) return;

    const shuffle = (array: any[]) => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };

    const pDeckCards = shuffle(selectedDeck.cardIds
      .map(id => allCards.find(c => c.cardNumber === id))
      .filter(Boolean) as Card[]);
    
    const opponentDeck = localSavedDecks.length > 1 ? localSavedDecks[1] : selectedDeck;
    const opponentDeckCards = shuffle(opponentDeck.cardIds
      .map(id => allCards.find(c => c.cardNumber === id))
      .filter(Boolean) as Card[]);

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
      playerDeck: pDeckCards, 
      opponentDeck: opponentDeckCards,
      playerPartner: playerPartner,
      opponentPartner: opponentPartner as Card,
      playerMpCard,
      opponentMpCard,
      playerPartnerId: Math.random().toString(36).substr(2, 9),
      opponentPartnerId: Math.random().toString(36).substr(2, 9),
      playerMpCardId: playerMpCard ? Math.random().toString(36).substr(2, 9) : undefined,
      opponentMpCardId: opponentMpCard ? Math.random().toString(36).substr(2, 9) : undefined,
    });
    setGameStarted(true);
  };

  const resumeSavedGame = () => {
    if (savedGame) {
      dispatch({ type: 'SET_STATE', state: savedGame });
      setGameStarted(true);
    }
  };

  const clearSaveAndExit = () => {
    if (window.confirm("進行状況を削除して終了しますか？")) {
      localStorage.removeItem('hp-tcg-save-game');
      onBack();
    }
  };

  useEffect(() => {
    if (deck && !gameStarted && !isOnline) {
       startGameWithDeck(deck);
    }
  }, [deck]);

  const handleMoveCard = (instanceId: string, from: string, to: string, card?: Card, index?: number) => {
    if (isSpectator) return;
    if (to === 'mainField' && state.player.mainField.length >= 3) {
      alert("メインフィールドは3枚までです。");
      return;
    }
    if (to === 'supportField' && state.player.supportField.length >= 4) {
      alert("サポートフィールドは4枚までです。");
      return;
    }

    let cardDetails = card;
    if (!cardDetails && from === 'hand') {
       cardDetails = state.player.hand.find(c => c.instanceId === instanceId)?.card;
    }

    dispatch({ type: 'MANUAL_MOVE', playerId: 'player', instanceId, from, to, card: cardDetails, index } as any);
    setSelectedCard(null);
  };

  const handleAttach = (parentInstanceId: string) => {
    if (isSpectator) return;
    if (!attachMode) return;
    dispatch({ type: 'ATTACH_CARD', playerId: 'player', instanceId: attachMode.instanceId, parentInstanceId });
    setAttachMode(null);
    setSelectedCard(null);
  };

  const promptOpenTopN = (isPublic: boolean) => {
    if (isSpectator) return;
    const val = window.prompt(`山札の上から何枚${isPublic ? '公開' : '非公開'}でオープンしますか？`, "3");
    if (val) {
      const n = parseInt(val);
      if (!isNaN(n)) dispatch({ type: 'SEARCH_DECK', playerId: 'player', isPublic, topCount: n });
    }
  };

  const renderCard = (instance: CardInstance, location: string, isOpponentSide: boolean = false, isAttached: boolean = false) => {
    const isLife = location === 'life';
    const isResting = !instance.isActive && !isLife;
    const isRevealed = instance.isRevealed;
    const isSmall = isOpponentSide && (location === 'hand' || location === 'deck' || location === 'trash' || location === 'life');

    return (
      <div className="card-container-wrapper" key={instance.instanceId}>
        <div 
          className={`card-slot ${isResting ? 'resting' : ''} ${isAttached ? 'attached-card-offset' : ''} ${isSmall ? 'small-card' : ''}`}
          onClick={() => {
            if (isSpectator) {
              // Spectators only see details if the card is revealed or naturally face-up
              if (isLife || location === 'hand') {
                if (isRevealed) setSelectedCard({ instance, location, isOpponent: isOpponentSide });
              } else if (location !== 'deck') {
                setSelectedCard({ instance, location, isOpponent: isOpponentSide });
              }
              return;
            }
            if (attachMode) {
                if (isOpponentSide) return;
                const targetLocs = ['mainField', 'supportField', 'partner'];
                if (instance.instanceId !== attachMode.instanceId && targetLocs.includes(location)) {
                  handleAttach(instance.instanceId);
                }
            } else if (isLife) {
                if (isOpponentSide) {
                  if (isRevealed) setSelectedCard({ instance, location, isOpponent: true });
                } else {
                  if (!isRevealed) {
                    dispatch({ type: 'REVEAL_CARD', playerId: 'player', instanceId: instance.instanceId });
                  } else {
                    setSelectedCard({ instance, location, isOpponent: false });
                  }
                }
            } else {
                if (isOpponentSide) {
                  // Hand is always hidden from opponent, and deck is face-down
                  if (location !== 'hand' && location !== 'deck') {
                    setSelectedCard({ instance, location, isOpponent: true });
                  }
                } else {
                  setSelectedCard({ instance, location, isOpponent: false });
                }
            }
          }}
        >
          {(isLife && !isRevealed) || (isOpponentSide && location === 'hand') ? (
             <div className="deck-back"></div>
          ) : (
             <>
               <img 
                 src={`${import.meta.env.BASE_URL}images/${instance.card.cardNumber.replace('/', '_')}.png`} alt={instance.card.cardName} className="card-image" />
               {isResting && <div className="resting-overlay">休息</div>}
               {isLife && isRevealed && <div className="revealed-badge">Revealed</div>}
             </>
          )}
          {instance.attachedItems.length > 0 && (
            <div className="attached-indicator"><Paperclip size={10}/></div>
          )}
        </div>
        {!isAttached && instance.attachedItems.map((att, idx) => (
            <div key={att.instanceId} className="attached-item-container" style={{ zIndex: idx + 1 }}>
                {renderCard(att, location, isOpponentSide, true)}
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
            {!isOpponent && !isSpectator && <button className="reset-all-btn" onClick={() => dispatch({ type: 'RESET_ALL_RESTED', playerId: 'player' })} title="Stand All"><RefreshCw size={10}/></button>}
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
              {!isOpponent && !isSpectator && (
                <div className="partner-effect-toggle">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={player.isPartnerEffectUsed} 
                      onChange={() => dispatch({ type: 'TOGGLE_PARTNER_EFFECT', playerId: 'player' })}
                    />
                    <span>効果使用済</span>
                  </label>
                </div>
              )}
              {(isOpponent || isSpectator) && (
                <div className="partner-effect-status">
                  <span className={`status-badge ${player.isPartnerEffectUsed ? 'used' : 'unused'}`}>
                    {player.isPartnerEffectUsed ? '効果使用済' : '効果未使用'}
                  </span>
                </div>
              )}
            </div>
          ) : <div className="card-slot"></div>}
        </div>

        <div className="zone deck-zone">
          <div className="zone-label">Deck ({player.deck.length})</div>
          <div className={`card-slot deck-back ${isOpponent ? 'small-card' : ''}`} onClick={() => {
            if (!isOpponent && !isSpectator) {
              const instanceId = Math.random().toString(36).substr(2, 9);
              dispatch({ type: 'DRAW_CARD', playerId: 'player', instanceId });
            }
          }}></div>
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
          <div className={`card-slot ${isOpponent ? 'small-card' : ''}`} onClick={() => setViewingTrash(isOpponent ? 'opponent' : 'player')}>
            {player.trash.length > 0 && renderCard(player.trash[player.trash.length - 1], 'trash', isOpponent)}
          </div>
        </div>

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
      </div>
    );
  };

  const renderCardDetailSide = () => {
    if (!selectedCard) {
      return (
        <div className="side-panel-placeholder">
          <p>カードを選択すると<br/>詳細が表示されます</p>
        </div>
      );
    }

    const { instance, location, isOpponent } = selectedCard;
    const { card } = instance;

    return (
      <div className="side-panel-content detail-content">
        <div className="detail-image-container-side">
          <img src={`${import.meta.env.BASE_URL}images/${card.cardNumber.replace('/', '_')}.png`} alt={card.cardName} className="detail-image-side" />
        </div>
        <div className="detail-info-side">
          <h3>{card.cardName}</h3>
          <p className="card-no">{card.cardNumber}</p>
          {!isOpponent && !isSpectator && (
            <div className="action-groups-side">
              <div className="action-group-side">
                <h4>状態</h4>
                <div className="action-buttons-grid">
                  <button className="action-btn-sm" onClick={() => dispatch({ type: 'ACTIVATE_CARD', playerId: 'player', instanceId: instance.instanceId })} disabled={instance.isActive}>スタンド</button>
                  <button className="action-btn-sm" onClick={() => { dispatch({ type: 'REST_CARD', playerId: 'player', instanceId: instance.instanceId }); setSelectedCard(null); }} disabled={!instance.isActive}>休息</button>
                  <button className="action-btn-sm" onClick={() => dispatch({ type: instance.isRevealed ? 'HIDE_CARD' : 'REVEAL_CARD', playerId: 'player', instanceId: instance.instanceId })}>
                    {instance.isRevealed ? '非公開' : '公開'}
                  </button>
                </div>
              </div>
              <div className="action-group-side">
                <h4>移動</h4>
                <div className="move-buttons-grid-side">
                  {location !== 'partner' && (
                    <>
                      <button disabled={location === 'mainField'} onClick={() => handleMoveCard(instance.instanceId, location, 'mainField')}>メイン</button>
                      <button disabled={location === 'supportField'} onClick={() => handleMoveCard(instance.instanceId, location, 'supportField')}>サポート</button>
                      <button disabled={location === 'mpField'} onClick={() => handleMoveCard(instance.instanceId, location, 'mpField')}>MP</button>
                      <button disabled={location === 'hand'} onClick={() => handleMoveCard(instance.instanceId, location, 'hand')}>手札</button>
                      <button onClick={() => { setAttachMode(instance); setSelectedCard(null); }}>装備する</button>
                      <button disabled={location === 'trash'} onClick={() => handleMoveCard(instance.instanceId, location, 'trash')}>トラッシュ</button>
                      <button onClick={() => handleMoveCard(instance.instanceId, location, 'deckTop')}>デッキ上</button>
                      <button onClick={() => handleMoveCard(instance.instanceId, location, 'deckBottom')}>デッキ下</button>
                    </>
                  )}
                  {location === 'partner' && (
                    <button onClick={() => { setAttachMode(instance); setSelectedCard(null); }}>装備する</button>
                  )}
                </div>
              </div>
            </div>
          )}
          {card.text && (
            <div className="card-text-side">
              {card.text}
            </div>
          )}
          {(isOpponent || isSpectator) && <div className="opponent-view-only">{isSpectator ? '観戦モード' : '相手のカード'}</div>}
          <button className="close-btn-side" onClick={() => setSelectedCard(null)}>閉じる</button>
        </div>
      </div>
    );
  };

  const renderDeckMenuSide = () => {
    if (isSpectator) return <div className="side-panel-placeholder"><p>観戦中</p></div>;
    return (
      <div className="side-panel-content deck-menu-content">
        <h4>デッキ操作</h4>
        <div className="deck-actions-list">
          <button onClick={() => dispatch({ type: 'DRAW_CARD', playerId: 'player', instanceId: Math.random().toString(36).substr(2, 9) })}>ドロー</button>
          <button onClick={() => dispatch({ type: 'DRAW_FROM_BOTTOM', playerId: 'player', instanceId: Math.random().toString(36).substr(2, 9) })}>デッキの下からドロー</button>
          <button onClick={() => promptOpenTopN(true)}>上からN枚公開</button>
          <button onClick={() => promptOpenTopN(false)}>上からN枚非公開で見る</button>
          <button onClick={() => dispatch({type:'SEARCH_DECK', playerId:'player', isPublic:true})}>公開サーチ</button>
          <button onClick={() => dispatch({type:'SEARCH_DECK', playerId:'player', isPublic:false})}>非公開サーチ</button>
          <button onClick={() => {
            const shuffle = (array: any[]) => {
              const newArray = [...array];
              for (let i = newArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
              }
              return newArray;
            };
            dispatch({ type: 'SHUFFLE_DECK', playerId: 'player', newDeck: shuffle(state.player.deck) });
          }}>シャッフル</button>
          <button onClick={() => dispatch({ type: 'SETUP_LIFE', playerId: 'player', instanceIds: [Math.random().toString(36).substr(2, 9), Math.random().toString(36).substr(2, 9), Math.random().toString(36).substr(2, 9)] })}>ライフを3枚セット</button>
        </div>
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
            {savedGame && (
              <div className="deck-select-card resume-card" onClick={resumeSavedGame}>
                <Save size={32} />
                <h3>Resume Last Game</h3>
                <p>前回の続きから再開</p>
                <div className="deck-select-meta">
                   <span><User size={12}/> {savedGame.player.name} vs {savedGame.opponent.name}</span>
                </div>
              </div>
            )}
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

  const getBoardTitle = () => {
    if (isSpectator) return 'Spectator Mode';
    if (isOnline) return isHost ? 'Online Match (Host)' : 'Online Match (Guest)';
    return 'Manual Duel Simulator';
  };

  return (
    <div className="manual-battle-container">
      {attachMode && (
          <div className="attach-banner">装備先のカードをクリックしてください（Main/Support/Partner） <button onClick={() => setAttachMode(null)}>キャンセル</button></div>
      )}
      <div className="board-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={14} /> Exit</button>
        <div className="board-title">{getBoardTitle()}</div>
        <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          {!isOnline && !isSpectator && (
            <button 
              className="action-btn-sm danger" 
              onClick={clearSaveAndExit}
              title="Clear Save and Exit"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', padding: '2px 8px', backgroundColor: '#742a2a', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              <Trash2 size={12} /> データを削除して終了
            </button>
          )}
          {isOnline && !isSpectator && (
            <button 
              className="sync-btn" 
              onClick={() => {
                if (window.confirm("自分の盤面状態を相手に送信して強制同期しますか？")) {
                  dispatch({ type: 'SET_STATE', state });
                }
              }}
              title="Force Sync State"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '2px 8px', backgroundColor: '#4a5568', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              <RefreshCw size={12} /> 同期
            </button>
          )}
        </div>
      </div>
      <div className="battle-area-new">
        <div className="game-boards-column">
          <div className="opponent-board-row">
            {renderPlayerSide(state.opponent, true)}
          </div>
          <div className="center-divider"></div>
          <div className="player-board-row">
            <div className="player-board-main">
              {renderPlayerSide(state.player, false)}
            </div>
            <div className="deck-menu-panel-side">
              {renderDeckMenuSide()}
            </div>
          </div>
        </div>
        <div className="details-panel-column">
          {renderCardDetailSide()}
        </div>
      </div>
      {state.activeSearch && (
        <div className="modal-overlay" onClick={() => { if(state.activeSearch?.playerId === 'player') dispatch({type:'CLOSE_SEARCH', playerId:'player'}); }}>
          <div className="modal-content deck-open-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{textAlign: 'center', marginBottom: '10px'}}>
              {state.activeSearch.playerId === 'player' ? (state.activeSearch.isPublic ? '公開サーチ/オープン' : '非公開サーチ/オープン') : '相手が山札を操作中...'}
            </h3>
            <div className="deck-top-grid">
              {(() => {
                const searcher = state[state.activeSearch.playerId];
                const isMe = state.activeSearch.playerId === 'player';
                const showContent = state.activeSearch.isPublic || isMe;
                const cards = state.activeSearch.snapshot || searcher.deck.map((c, i) => ({ 
                  instanceId: `deck-${i}-${c.cardNumber}`, 
                  card: c 
                }));

                return cards.map((inst, idx) => {
                  const card = 'card' in inst ? inst.card : (inst as any);
                  const instanceId = 'instanceId' in inst ? inst.instanceId : `deck-${idx}-${(inst as any).cardNumber}`;

                  return (
                    <div key={instanceId} className="deck-top-item">
                      <div className="card-slot small">
                        {showContent ? (
                          <img src={`${import.meta.env.BASE_URL}images/${card.cardNumber.replace('/', '_')}.png`} alt={card.cardName} className="card-image" />
                        ) : (
                          <div className="deck-back"></div>
                        )}
                      </div>
                      {isMe && !isSpectator && (
                        <div className="deck-top-actions">
                          <button onClick={() => handleMoveCard(instanceId, 'deck', 'hand', card, idx)}>Hand</button>
                          <button onClick={() => handleMoveCard(instanceId, 'deck', 'deckTop', card, idx)}>Top</button>
                          <button onClick={() => { if (state.player.mainField.length >= 3) { alert("メインフィールドは3枚までです。"); return; } handleMoveCard(instanceId, 'deck', 'mainField', card, idx); }}>Main</button>
                          <button onClick={() => handleMoveCard(instanceId, 'deck', 'trash', card, idx)}>Trash</button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            {state.activeSearch.playerId === 'player' && !isSpectator && (
               <button className="close-btn" onClick={() => dispatch({type:'CLOSE_SEARCH', playerId:'player'})}>Done</button>
            )}
          </div>
        </div>
      )}
      {viewingTrash && (
        <div className="modal-overlay" onClick={() => setViewingTrash(null)}>
          <div className="modal-content deck-open-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{textAlign: 'center', marginBottom: '10px'}}>{viewingTrash === 'player' ? '自分のトラッシュ' : '相手のトラッシュ'} ({state[viewingTrash].trash.length} cards)</h3>
            <div className="deck-top-grid">
              {state[viewingTrash].trash.map((inst) => (
                <div key={inst.instanceId} className="deck-top-item">
                  <div className="card-slot small"><img src={`${import.meta.env.BASE_URL}images/${inst.card.cardNumber.replace('/', '_')}.png`} alt={inst.card.cardName} className="card-image" /></div>
                  <div className="deck-top-actions">
                    {viewingTrash === 'player' && !isSpectator && (
                      <>
                        <button onClick={() => { dispatch({ type: 'MANUAL_MOVE', playerId: 'player', from: 'trash', to: 'hand', instanceId: inst.instanceId }); }}>Hand</button>
                        <button onClick={() => { dispatch({ type: 'MANUAL_MOVE', playerId: 'player', from: 'trash', to: 'deckBottom', instanceId: inst.instanceId }); }}>Deck Btm</button>
                      </>
                    )}
                    <button onClick={() => setSelectedCard({instance: inst, location: 'trash', isOpponent: viewingTrash === 'opponent'})}>Detail</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="close-btn" onClick={() => setViewingTrash(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualBattleBoard;
