import Card from '../Card/Card';
import './Board.css';

const SUIT_SYMBOLS = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];

const Board = ({ gameState, onDrawStock, onMoveToTableau, onMoveToFoundation }) => {
  const { tableau, foundations, stock, waste } = gameState;

  const handleDragStart = (e, card, location) => {
    e.dataTransfer.setData('card', JSON.stringify(card));
    e.dataTransfer.setData('location', JSON.stringify(location));
  };

  const handleDropTableau = (e, col) => {
    e.preventDefault();
    const card = JSON.parse(e.dataTransfer.getData('card'));
    const location = JSON.parse(e.dataTransfer.getData('location'));
    onMoveToTableau(card, location, col);
  };

  const handleDropFoundation = (e, fIdx) => {
    e.preventDefault();
    const card = JSON.parse(e.dataTransfer.getData('card'));
    const location = JSON.parse(e.dataTransfer.getData('location'));
    onMoveToFoundation(card, location, fIdx);
  };

  const handleWasteDoubleClick = (card) => {
    // Try foundation first, then tableau
    const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
    const fIdx = suits.indexOf(card.suit);
    onMoveToFoundation(card, { type: 'waste' }, fIdx);
  };

  const handleTableauDoubleClick = (card, col) => {
    const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
    const fIdx = suits.indexOf(card.suit);
    onMoveToFoundation(card, { type: 'tableau', col }, fIdx);
  };

  return (
    <div className="board">
      {/* Top row: stock, waste, spacers, foundations */}
      <div className="board-top">
        {/* Stock */}
        <div className="stock-pile" onClick={onDrawStock}>
          {stock.length > 0
            ? <Card card={{ faceUp: false }} />
            : <div className="card card-empty">↺</div>}
        </div>

        {/* Waste */}
        <div className="waste-pile">
          {waste.length > 0 ? (
            <Card
              card={waste[waste.length - 1]}
              draggable
              onDragStart={e => handleDragStart(e, waste[waste.length - 1], { type: 'waste' })}
              onDoubleClick={() => handleWasteDoubleClick(waste[waste.length - 1])}
            />
          ) : (
            <div className="card card-empty" />
          )}
        </div>

        <div className="spacer" />

        {/* Foundations */}
        {foundations.map((foundation, fIdx) => (
          <div
            key={fIdx}
            className="foundation-pile"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDropFoundation(e, fIdx)}
          >
            {foundation.length > 0 ? (
              <Card card={foundation[foundation.length - 1]} />
            ) : (
              <div className="card card-empty foundation-empty">
                {SUIT_SYMBOLS[SUITS[fIdx]]}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="board-tableau">
        {tableau.map((pile, col) => (
          <div
            key={col}
            className="tableau-pile"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDropTableau(e, col)}
          >
            {pile.length === 0
              ? <div className="card card-empty" />
              : pile.map((card, i) => (
                <Card
                  key={card.id}
                  card={card}
                  style={{ top: `${i * 28}px`, position: 'absolute' }}
                  draggable={card.faceUp}
                  onDragStart={e => handleDragStart(e, card, { type: 'tableau', col })}
                  onDoubleClick={() => card.faceUp && handleTableauDoubleClick(card, col)}
                />
              ))
            }
          </div>
        ))}
      </div>
    </div>
  );
};

export default Board;
