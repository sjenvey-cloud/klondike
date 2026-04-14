import React, { useContext } from 'react';
import { getRank, getSuit, rankLabel } from '../../services/gameLogic';
import { PreferencesContext } from '../../App';
import './Card.css';

// ── Design renderers ──────────────────────────────────────────────────────

function StandardFace({ label, suit, colorClass, selected }) {
  return (
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
  );
}

function ClassicFace({ label, suit, colorClass, selected }) {
  return (
    <div className={`card-face card-face--classic ${colorClass}${selected ? ' selected' : ''}`}>
      <div className="card-corner top">
        <span className="card-rank">{label}</span>
        <span className="card-suit-small">{suit.symbol}</span>
      </div>
      <div className="card-classic-center">
        <span className="card-classic-rank">{label}</span>
        <span className="card-classic-suit">{suit.symbol}</span>
      </div>
      <div className="card-corner bottom">
        <span className="card-rank">{label}</span>
        <span className="card-suit-small">{suit.symbol}</span>
      </div>
    </div>
  );
}

function MinimalFace({ label, suit, colorClass, selected }) {
  return (
    <div className={`card-face card-face--minimal ${colorClass}${selected ? ' selected' : ''}`}>
      <div className="card-minimal-suit-indicator">{suit.symbol}</div>
      <div className="card-minimal-rank">{label}</div>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────

export function Card({ card, faceUp, selected, onClick, design: designProp }) {
  const { preferences } = useContext(PreferencesContext);
  const design = designProp || preferences.cardFaceDesign || 'standard';

  if (!faceUp) {
    const hasPattern = Boolean(preferences?.cardBackPattern);
    return (
      <div className="card-wrap" onClick={onClick}>
        <div className={`card-back${hasPattern ? ' has-pattern' : ''}`} />
      </div>
    );
  }

  const rank = getRank(card);
  const suit = getSuit(card);
  const label = rankLabel(rank);
  const colorClass = suit.color;

  const faceProps = { label, suit, colorClass, selected };

  return (
    <div className="card-wrap" onClick={onClick}>
      {design === 'minimal' ? (
        <MinimalFace {...faceProps} />
      ) : design === 'classic' ? (
        <ClassicFace {...faceProps} />
      ) : (
        <StandardFace {...faceProps} />
      )}
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
