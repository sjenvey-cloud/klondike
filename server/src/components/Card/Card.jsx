import './Card.css';

const SUIT_SYMBOLS = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const RED_SUITS = ['diamonds', 'hearts'];

const Card = ({ card, onClick, onDoubleClick, style, draggable, onDragStart }) => {
  if (!card) return <div className="card card-placeholder" style={style} />;

  if (!card.faceUp) {
    return (
      <div className="card card-back" style={style} onClick={onClick}>
        <div className="card-back-pattern" />
      </div>
    );
  }

  const isRed = RED_SUITS.includes(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <div
      className={`card card-face ${isRed ? 'red' : 'black'}`}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <div className="card-corner top-left">
        <span className="card-value">{card.value}</span>
        <span className="card-suit">{symbol}</span>
      </div>
      <div className="card-center">{symbol}</div>
      <div className="card-corner bottom-right">
        <span className="card-value">{card.value}</span>
        <span className="card-suit">{symbol}</span>
      </div>
    </div>
  );
};

export default Card;
