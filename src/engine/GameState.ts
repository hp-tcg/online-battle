import { Card } from '../types';

export type TurnPhase = 'STANDBY' | 'MAIN' | 'BATTLE' | 'END';

export interface CardInstance {
  instanceId: string; // Unique ID for this instance in game
  card: Card;
  isActive: boolean; // Active (vertical) or Rest (horizontal)
  isRevealed?: boolean; // Visible to both players
  attachedItems: CardInstance[];
}

export interface PlayerState {
  id: string;
  name: string;
  deck: Card[];
  hand: CardInstance[];
  life: CardInstance[]; // Cards in life area (face down usually)
  mainField: CardInstance[]; // Characters
  supportField: CardInstance[]; // Locations, Items, Supporters
  mpField: CardInstance[]; // Location or MP cards
  partner: CardInstance | null;
  trash: CardInstance[];
  mpCount: number;
  isPartnerEffectUsed: boolean;
}

export interface GameState {
  player: PlayerState;
  opponent: PlayerState;
  turnOwner: 'player' | 'opponent';
  phase: TurnPhase;
  turnCount: number;
  log: string[];
  activeSearch: {
    playerId: 'player' | 'opponent';
    isPublic: boolean;
    topCount?: number;
    snapshot?: CardInstance[]; // Fixed set of cards for Open N
  } | null;
}

export type GameAction =
  | { type: 'SET_STATE'; state: GameState }
  | { type: 'START_GAME'; playerDeck: Card[]; opponentDeck: Card[]; playerPartner: Card; opponentPartner: Card; playerMpCard?: Card; opponentMpCard?: Card; playerPartnerId?: string; opponentPartnerId?: string; playerMpCardId?: string; opponentMpCardId?: string }
  | { type: 'DRAW_CARD'; playerId: 'player' | 'opponent'; instanceId?: string }
  | { type: 'DRAW_FROM_BOTTOM'; playerId: 'player' | 'opponent'; instanceId?: string }
  | { type: 'SHUFFLE_DECK'; playerId: 'player' | 'opponent'; newDeck?: Card[] }
  | { type: 'SETUP_LIFE'; playerId: 'player' | 'opponent'; instanceIds?: string[] }
  | { type: 'PLAY_CARD'; playerId: 'player' | 'opponent'; instanceId: string; targetField: 'mainField' | 'supportField' | 'mpField' }
  | { type: 'ACTIVATE_CARD'; playerId: 'player' | 'opponent'; instanceId: string }
  | { type: 'REST_CARD'; playerId: 'player' | 'opponent'; instanceId: string }
  | { type: 'RESET_ALL_RESTED'; playerId: 'player' | 'opponent' }
  | { type: 'ATTACK'; attackerId: string; targetId: 'partner' | string } 
  | { type: 'TAKE_DAMAGE'; playerId: 'player' | 'opponent'; amount: number }
  | { type: 'NEXT_PHASE' }
  | { type: 'END_TURN' }
  | { type: 'MOVE_TO_MP'; playerId: 'player' | 'opponent'; instanceId: string }
  | { type: 'FLIP_LIFE'; playerId: 'player' | 'opponent'; instanceId: string }
  | { type: 'ATTACH_CARD'; playerId: 'player' | 'opponent'; instanceId: string; parentInstanceId: string }
  | { type: 'TOGGLE_PARTNER_EFFECT', playerId: 'player' | 'opponent' }
  | { type: 'SEARCH_DECK', playerId: 'player' | 'opponent'; isPublic: boolean; topCount?: number }
  | { type: 'CLOSE_SEARCH', playerId: 'player' | 'opponent' }
  | { type: 'REVEAL_CARD', playerId: 'player' | 'opponent'; instanceId: string }
  | { type: 'HIDE_CARD', playerId: 'player' | 'opponent'; instanceId: string }
  | { type: 'REST_ALL_MP', playerId: 'player' | 'opponent' }
  | { type: 'SHUFFLE_HAND_INTO_DECK', playerId: 'player' | 'opponent' }
  | { type: 'DETERMINE_TURN_ORDER' }
  | { type: 'MANUAL_MOVE', playerId: 'player' | 'opponent'; instanceId?: string; from: string; to: string; index?: number; card?: Card };

