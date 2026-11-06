// Maps each logical card to its exact individual image filename.
export const cardFilename = card => `${({11:"J",12:"Q",13:"K",14:"A"}[card.rank]??card.rank)}${card.suit}.png`;
export const cardImagePath = card => `assets/cards/${cardFilename(card)}`;
export const cardAlt = card => `${({11:"Jack",12:"Queen",13:"King",14:"Ace"}[card.rank]??card.rank)} of ${{S:"Spades",H:"Hearts",D:"Diamonds",C:"Clubs"}[card.suit]}`;
