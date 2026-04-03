import React from 'react';
import { getRank, getSuit, rankLabel } from '../../services/gameLogic';
import './Card.css';

export function Card({ card, faceUp, selected, onClick }) {
  if (!faceUp) {
    return (
      <div className="card-wrap" onClick={onClick}>
        <div className="card-back" />
      </div>
    );
  }

  const rank = getRank(card);
  const suit = getSuit(card);
  const label = rankLabel(rank);
  const colorClass = suit.color;

  return (
    <div className="card-wrap" onClick={onClick}>
      <div className={`card-face ${colorClass}${selected ? ' selected' : ''}`}>
        <div className="card-corner top">
          <span className="card-rank">{label}</span>
          <span className="card-suit-small">{suit.symbol}</span>
        </div>
        <span className="card-suit-center">{suit.symbol}</span>
        <div className="card-corner bottom">
          <span className="card-rank">{label}</span>
          <span className="card-suit-small">{suit.symbol}</span>
        </div>
      </div>
    </div>
  );
}

export function CardSlot({ onClick, children }) {
  return (
    <div className="card-slot" onClick={onClick}>
      {children}
    </div>
  );
}
