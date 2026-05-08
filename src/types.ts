export interface CardType {
  id: number;
  value: string;
}

export interface Rarity {
  id: number;
  value: string;
}

export interface Tag {
  id: number;
  value: string;
}

export interface SpecialIcon {
  id: number;
  value: string;
}

export interface Product {
  id: number;
  value: string;
}

export interface Card {
  id: number;
  cardNumber: string;
  cardName: string;
  cardType: CardType;
  rarity: Rarity;
  cost: number | null;
  mp: number | null;
  ap: number | null;
  dp: number | null;
  text: string;
  parallel: boolean;
  canAddToDeck: boolean;
  tags: Tag[];
  specialIcons: SpecialIcon[];
  products: Product[];
  imageUrl: string;
}

export interface Deck {
  name: string;
  partnerId?: string;
  mpCardId?: string;
  cardIds: string[]; // List of card numbers
}
