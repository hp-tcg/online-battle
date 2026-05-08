import React, { useReducer, useEffect } from 'react';
import { CardInstance } from '../engine/GameState';
import { gameReducer, initialState } from '../engine/GameReducer';
import { Card } from '../types';
import './BattleBoard.css';

interface BattleBoardProps {
  playerDeck: Card[];
  opponentDeck: Card[];
  playerPartner: Card;
  opponentPartner: Card;
  onExit: () => void;
}

const BattleBoard: React.FC<BattleBoardProps> = ({ playerDeck, opponentDeck, playerPartner, opponentPartner, onExit }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    dispatch({ type: 'START_GAME', playerDeck, opponentDeck, playerPartner, opponentPartner });
  }, []);

  // CPU Turn Logic
  useEffect(() => {
    if (state.turnOwner === 'opponent') {
      const timer = setTimeout(() => {
        if (state.phase === 'STANDBY') {
          dispatch({ type: 'DRAW_CARD', playerId: 'opponent' });
          dispatch({ type: 'NEXT_PHASE' });
        } else if (state.phase === 'MAIN') {
          // Play a card if possible
          if (state.opponent.hand.length > 0) {
             const cardToPlay = state.opponent.hand[0];
             dispatch({ type: 'PLAY_CARD', playerId: 'opponent', instanceId: cardToPlay.instanceId, targetField: 'mainField' });
          }
          dispatch({ type: 'NEXT_PHASE' });
        } else if (state.phase === 'BATTLE') {
          dispatch({ type: 'NEXT_PHASE' });
        } else if (state.phase === 'END') {
          dispatch({ type: 'END_TURN' });
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.turnOwner, state.phase]);

  const renderField = (cards: CardInstance[], label: string) => (
    <div className="field-section">
      <span className="field-label">{label}</span>
      <div className="field-cards">
        {cards.map(c => (
          <div key={c.instanceId} className={`battle-card ${c.isActive ? 'active' : 'rest'}`}>
            <img src={`${import.meta.env.BASE_URL}images/${c.card.cardNumber.replace('/', '_')}.png`} alt={c.card.cardName} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="battle-container">
      <div className="battle-header">
        <button onClick={onExit} className="exit-btn">降参する</button>
        <div className="turn-info">
          Turn {state.turnCount} - {state.turnOwner === 'player' ? 'Player' : 'CPU'}'s {state.phase}
        </div>
        <button onClick={() => dispatch({ type: 'NEXT_PHASE' })} className="next-btn">次のフェイズ</button>
      </div>

      <div className="play-area">
        {/* Opponent Side */}
        <div className="player-side opponent-side">
          <div className="hand-row">
            {state.opponent.hand.map(c => <div key={c.instanceId} className="card-back" />)}
          </div>
          <div className="field-rows">
            {renderField(state.opponent.mpField, 'MP')}
            {renderField(state.opponent.supportField, 'Support')}
            {renderField(state.opponent.mainField, 'Main')}
            <div className="partner-area">
              {state.opponent.partner && (
                <div className="battle-card active partner-card">
                   <img src={`${import.meta.env.BASE_URL}images/${state.opponent.partner.card.cardNumber.replace('/', '_')}.png`} alt="partner" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Player Side */}
        <div className="player-side player-side-ui">
          <div className="field-rows">
            <div className="partner-area">
              {state.player.partner && (
                <div className="battle-card active partner-card">
                   <img src={`${import.meta.env.BASE_URL}images/${state.player.partner.card.cardNumber.replace('/', '_')}.png`} alt="partner" />
                </div>
              )}
            </div>
            {renderField(state.player.mainField, 'Main')}
            {renderField(state.player.supportField, 'Support')}
            {renderField(state.player.mpField, 'MP')}
          </div>
          <div className="hand-row player-hand">
            {state.player.hand.map(c => (
              <div 
                key={c.instanceId} 
                className="battle-card hand-card"
                onClick={() => dispatch({ type: 'PLAY_CARD', playerId: 'player', instanceId: c.instanceId, targetField: 'mainField' })}
              >
                <img src={`${import.meta.env.BASE_URL}images/${c.card.cardNumber.replace('/', '_')}.png`} alt={c.card.cardName} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="battle-log">
        {state.log.slice(-5).map((entry, i) => <div key={i}>{entry}</div>)}
      </div>
    </div>
  );
};

export default BattleBoard;
