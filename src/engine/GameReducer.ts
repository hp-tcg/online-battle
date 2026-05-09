import { GameState, GameAction, PlayerState, CardInstance, TurnPhase } from './GameState';
import { Card } from '../types';

const createInstance = (card: Card, instanceId?: string): CardInstance => ({
  instanceId: instanceId || Math.random().toString(36).substr(2, 9),
  card,
  isActive: true,
  attachedItems: [],
});

const shuffle = (array: any[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const initialPlayerState = (name: string): PlayerState => ({
  id: name.toLowerCase(),
  name,
  deck: [],
  hand: [],
  life: [],
  mainField: [],
  supportField: [],
  mpField: [],
  partner: null,
  trash: [],
  mpCount: 0,
  isPartnerEffectUsed: false,
});

export const initialState: GameState = {
  player: initialPlayerState('Player'),
  opponent: initialPlayerState('CPU'),
  turnOwner: 'player',
  phase: 'STANDBY',
  turnCount: 0,
  log: ['Welcome to Hogwarts Duel!'],
  activeSearch: null,
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_STATE':
      return action.state;

    case 'START_GAME': {
      const pDeck = action.playerDeck;
      const oDeck = action.opponentDeck;
      
      return {
        ...state,
        player: {
          ...state.player,
          deck: pDeck,
          hand: [],
          life: [],
          partner: createInstance(action.playerPartner, action.playerPartnerId),
          mpField: action.playerMpCard ? [createInstance(action.playerMpCard, action.playerMpCardId)] : [],
        },
        opponent: {
          ...state.opponent,
          deck: oDeck,
          hand: [],
          life: [],
          partner: createInstance(action.opponentPartner, action.opponentPartnerId),
          mpField: action.opponentMpCard ? [createInstance(action.opponentMpCard, action.opponentMpCardId)] : [],
        },
        phase: 'STANDBY',
        log: [...state.log, 'Game Started!'],
      };
    }

    case 'DRAW_CARD': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      if (player.deck.length === 0) return { ...state, log: [...state.log, `${player.name} has no cards left!`] };
      
      const [card, ...remainingDeck] = player.deck;
      return {
        ...state,
        [target]: {
          ...player,
          deck: remainingDeck,
          hand: [...player.hand, createInstance(card, action.instanceId)],
        },
        log: [...state.log, `${player.name} draws a card.`],
      };
    }

    case 'DRAW_FROM_BOTTOM': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      if (player.deck.length === 0) return { ...state, log: [...state.log, `${player.name} has no cards left!`] };
      
      const remainingDeck = [...player.deck];
      const card = remainingDeck.pop();
      if (!card) return state;

      return {
        ...state,
        [target]: {
          ...player,
          deck: remainingDeck,
          hand: [...player.hand, createInstance(card, action.instanceId)],
        },
        log: [...state.log, `${player.name} draws from bottom of deck.`],
      };
    }

    case 'SHUFFLE_DECK': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      return {
        ...state,
        [target]: {
          ...player,
          deck: action.newDeck || shuffle(player.deck),
        },
        log: [...state.log, `${player.name} shuffled their deck.`],
      };
    }

    case 'SETUP_LIFE': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      if (player.deck.length < 3) return { ...state, log: [...state.log, 'Not enough cards in deck!'] };
      
      const deckCopy = [...player.deck];
      const setupCards = deckCopy.splice(0, 3).map((c, i) => createInstance(c, action.instanceIds?.[i]));
      // Life cards start active (not resting) and face down (handled in UI)
      const initialLifeCards = setupCards.map(c => ({ ...c, isActive: true }));

      return {
        ...state,
        [target]: {
          ...player,
          deck: deckCopy,
          life: [...player.life, ...initialLifeCards],
        },
        log: [...state.log, `${player.name} set up 3 life cards.`],
      };
    }

    case 'RESET_ALL_RESTED': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      
      const reset = (field: CardInstance[]) => field.map(c => ({ 
        ...c, 
        isActive: true, 
        attachedItems: c.attachedItems.map(a => ({ ...a, isActive: true })) 
      }));

      return {
        ...state,
        [target]: {
          ...player,
          mainField: reset(player.mainField),
          supportField: reset(player.supportField),
          mpField: reset(player.mpField),
          partner: player.partner ? { ...player.partner, isActive: true, attachedItems: player.partner.attachedItems.map(a => ({ ...a, isActive: true })) } : null,
        },
        log: [...state.log, `${player.name} reset all resting cards.`],
      };
    }

    case 'PLAY_CARD': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const cardIdx = player.hand.findIndex(c => c.instanceId === action.instanceId);
      if (cardIdx === -1) return state;

      const cardInstance = player.hand[cardIdx];
      const newHand = [...player.hand];
      newHand.splice(cardIdx, 1);

      return {
        ...state,
        [target]: {
          ...player,
          hand: newHand,
          [action.targetField]: [...player[action.targetField], cardInstance],
        },
        log: [...state.log, `${player.name} plays ${cardInstance.card.cardName}.`],
      };
    }

    case 'NEXT_PHASE': {
      const phases: TurnPhase[] = ['STANDBY', 'MAIN', 'BATTLE', 'END'];
      const currentIdx = phases.indexOf(state.phase);
      const nextIdx = (currentIdx + 1) % phases.length;
      
      if (nextIdx === 0) { // Should call END_TURN instead
        return state;
      }

      return {
        ...state,
        phase: phases[nextIdx],
        log: [...state.log, `Phase changed to ${phases[nextIdx]}`],
      };
    }

    case 'ACTIVATE_CARD': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const updateField = (field: CardInstance[]) => field.map(c => {
        if (c.instanceId === action.instanceId) return { ...c, isActive: true };
        return { ...c, attachedItems: c.attachedItems.map(a => a.instanceId === action.instanceId ? { ...a, isActive: true } : a) };
      });

      return {
        ...state,
        [target]: {
          ...player,
          mainField: updateField(player.mainField),
          supportField: updateField(player.supportField),
          mpField: updateField(player.mpField),
          partner: player.partner?.instanceId === action.instanceId ? { ...player.partner, isActive: true } : player.partner,
        }
      };
    }

    case 'REST_CARD': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const updateField = (field: CardInstance[]) => field.map(c => {
        if (c.instanceId === action.instanceId) return { ...c, isActive: false };
        return { ...c, attachedItems: c.attachedItems.map(a => a.instanceId === action.instanceId ? { ...a, isActive: false } : a) };
      });

      return {
        ...state,
        [target]: {
          ...player,
          mainField: updateField(player.mainField),
          supportField: updateField(player.supportField),
          mpField: updateField(player.mpField),
          partner: player.partner?.instanceId === action.instanceId ? { ...player.partner, isActive: false } : player.partner,
        }
      };
    }

    case 'FLIP_LIFE': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const cardIdx = player.life.findIndex(c => c.instanceId === (action as any).instanceId);
      if (cardIdx === -1) return state;

      const cardInstance = player.life[cardIdx];
      const newLife = [...player.life];
      newLife.splice(cardIdx, 1);

      return {
        ...state,
        [target]: {
          ...player,
          life: newLife,
          trash: [...player.trash, cardInstance],
        },
        log: [...state.log, `${player.name} flipped a life card and moved it to trash.`],
      };
    }

    case 'ATTACH_CARD': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const { instanceId, parentInstanceId } = action;

      let cardToAttach: CardInstance | null = null;
      let newPlayerState = { ...player };

      // Find card in all possible locations
      const locations = ['hand', 'mainField', 'supportField', 'mpField', 'trash'];
      for (const loc of locations) {
        const field = (player as any)[loc] as CardInstance[];
        const idx = field.findIndex(c => c.instanceId === instanceId);
        if (idx !== -1) {
          cardToAttach = field[idx];
          const newField = [...field];
          newField.splice(idx, 1);
          (newPlayerState as any)[loc] = newField;
          break;
        }
      }

      if (!cardToAttach) return state;

      // Find parent card and attach
      const attachToField = (field: CardInstance[]) => field.map(c => {
        if (c.instanceId === parentInstanceId) {
          return { ...c, attachedItems: [...c.attachedItems, cardToAttach!] };
        }
        return c;
      });

      return {
        ...state,
        [target]: {
          ...newPlayerState,
          mainField: attachToField(newPlayerState.mainField),
          supportField: attachToField(newPlayerState.supportField),
          partner: newPlayerState.partner?.instanceId === parentInstanceId ? { ...newPlayerState.partner, attachedItems: [...newPlayerState.partner.attachedItems, cardToAttach] } : newPlayerState.partner,
        },
        log: [...state.log, `${player.name} attached a card.`],
      };
    }

    case 'TOGGLE_PARTNER_EFFECT': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      return {
        ...state,
        [target]: {
          ...state[target],
          isPartnerEffectUsed: !state[target].isPartnerEffectUsed
        }
      };
    }

    case 'SEARCH_DECK': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const type = action.isPublic ? 'publicly' : 'privately';
      
      // If topCount is provided, create a snapshot of the current top cards
      const snapshot = action.topCount 
        ? player.deck.slice(0, action.topCount).map(c => createInstance(c))
        : undefined;

      return {
        ...state,
        activeSearch: {
          playerId: action.playerId,
          isPublic: action.isPublic,
          topCount: action.topCount,
          snapshot,
        },
        log: [...state.log, `${player.name} is searching their deck ${type}.`],
      };
    }

    case 'CLOSE_SEARCH': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      return {
        ...state,
        activeSearch: null,
        log: [...state.log, `${player.name} finished searching their deck.`],
      };
    }

    case 'REVEAL_CARD': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const update = (cards: CardInstance[]) => cards.map(c => c.instanceId === action.instanceId ? { ...c, isRevealed: true } : c);
      
      return {
        ...state,
        [target]: {
          ...player,
          hand: update(player.hand),
          life: update(player.life),
          mainField: update(player.mainField),
          supportField: update(player.supportField),
          mpField: update(player.mpField),
          trash: update(player.trash),
          partner: player.partner?.instanceId === action.instanceId ? { ...player.partner, isRevealed: true } : player.partner,
        },
        log: [...state.log, `${player.name} revealed a card.`],
      };
    }

    case 'HIDE_CARD': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const update = (cards: CardInstance[]) => cards.map(c => c.instanceId === action.instanceId ? { ...c, isRevealed: false } : c);
      
      return {
        ...state,
        [target]: {
          ...player,
          hand: update(player.hand),
          life: update(player.life),
          mainField: update(player.mainField),
          supportField: update(player.supportField),
          mpField: update(player.mpField),
          trash: update(player.trash),
          partner: player.partner?.instanceId === action.instanceId ? { ...player.partner, isRevealed: false } : player.partner,
        }
      };
    }

    case 'REST_ALL_MP': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      return {
        ...state,
        [target]: {
          ...player,
          mpField: player.mpField.map(c => ({ ...c, isActive: false })),
        },
        log: [...state.log, `${player.name} rested all MP cards.`],
      };
    }

    case 'SHUFFLE_HAND_INTO_DECK': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const newDeck = shuffle([...player.deck, ...player.hand.map(c => c.card)]);
      return {
        ...state,
        [target]: {
          ...player,
          hand: [],
          deck: newDeck,
        },
        log: [...state.log, `${player.name} shuffled their hand back into the deck.`],
      };
    }

    case 'DETERMINE_TURN_ORDER': {
      const first = Math.random() < 0.5 ? 'player' : 'opponent';
      return {
        ...state,
        turnOwner: first,
        log: [...state.log, `${state[first].name} goes first!`],
      };
    }

    case 'MANUAL_MOVE': {
      const target = action.playerId === 'player' ? 'player' : 'opponent';
      const player = state[target];
      const { from, to, instanceId, index, card } = action as any;

      let cardInstance: CardInstance | null = null;
      let newFromState = { ...player };

      if (from === 'deck') {
        const deckCopy = [...player.deck];
        const deckCard = deckCopy.splice(index, 1)[0];
        cardInstance = createInstance(deckCard, instanceId);
        newFromState.deck = deckCopy;
      } else {
        // Search including attached items
        const searchAndRemove = (field: CardInstance | CardInstance[] | null): [CardInstance | null, any] => {
          if (!field) return [null, null];
          if (Array.isArray(field)) {
            let idx = field.findIndex(c => c.instanceId === instanceId);
            
            // Online Play fallback: if ID not found but we're moving from hand and have card data, find by card number
            if (idx === -1 && from === 'hand' && card) {
              idx = field.findIndex(c => c.card.cardNumber === card.cardNumber);
            }

            if (idx !== -1) {
              const inst = field[idx];
              const newField = [...field];
              newField.splice(idx, 1);
              return [inst, newField];
            }
            // Check attached
            for (let i = 0; i < field.length; i++) {
              const [inst, newAttached] = searchAndRemove(field[i].attachedItems);
              if (inst) {
                const newField = [...field];
                newField[i] = { ...field[i], attachedItems: newAttached || [] };
                return [inst, newField];
              }
            }
          } else if (field.instanceId === instanceId) {
            return [field, null];
          }
          return [null, field];
        };

        const locs = ['hand', 'mainField', 'supportField', 'mpField', 'trash', 'life', 'partner'];
        for (const loc of locs) {
          const [inst, newField] = searchAndRemove((player as any)[loc]);
          if (inst) {
            cardInstance = inst;
            (newFromState as any)[loc] = newField;
            break;
          }
        }

        // If cardInstance was not found locally but we have the card data (Online Play Hand -> Field)
        if (!cardInstance && card) {
           cardInstance = createInstance(card, instanceId);
        }
      }

      if (!cardInstance) return state;

      const newToState = { ...newFromState };

      if (to === 'deckTop') {
        newToState.deck = [cardInstance.card, ...newToState.deck];
      } else if (to === 'deckBottom') {
        newToState.deck = [...newToState.deck, cardInstance.card];
      } else {
        const destField = (newToState as any)[to];
        if (Array.isArray(destField)) {
          (newToState as any)[to] = [...destField, cardInstance];
        } else {
          (newToState as any)[to] = cardInstance;
        }
      }

      return {
        ...state,
        [target]: newToState,
        activeSearch: state.activeSearch ? {
          ...state.activeSearch,
          snapshot: state.activeSearch.snapshot?.filter(c => c.instanceId !== instanceId)
        } : null,
        log: [...state.log, `${player.name} moved a card from ${from} to ${to}.`],
      };
    }

    default:
      return state;
  }
}
