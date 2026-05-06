import React, { useContext } from 'react';
import { getRank, getSuit, rankLabel } from '../../services/gameLogic';
import { PreferencesContext } from '../../App';
import './Card.css';

// ── Image-based card renderer (sprite sheets) ────────────────────────────

const SUIT_CODE = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' };

// Style → subfolder and back image
const STYLE_CONFIG = {
  classic: { folder: '',        back: '/cards/back_red.png'           },
  fantasy: { folder: 'fantasy', back: '/cards/fantasy/back_blue.png'  },
  modern:  { folder: 'modern',  back: '/cards/modern/back_red.png'    },
};

function ImageFace({ rank, suit, selected, cardStyle }) {
  const rankCode = rankLabel(rank); // 'A', '2', ..., '10', 'J', 'Q', 'K'
  const suitCode = SUIT_CODE[suit.name];
  const { folder } = STYLE_CONFIG[cardStyle] || STYLE_CONFIG.classic;
  const src = folder ? `/cards/${folder}/${rankCode}_${suitCode}.png`
                     : `/cards/${rankCode}_${suitCode}.png`;
  return (
    <img
      className={`card-image${selected ? ' card-image--selected' : ''}`}
      src={src}
      alt={`${rankCode} of ${suit.name}`}
      draggable={false}
    />
  );
}

function ImageBack({ cardStyle }) {
  const { back } = STYLE_CONFIG[cardStyle] || STYLE_CONFIG.classic;
  return (
    <img
      className="card-image"
      src={back}
      alt="card back"
      draggable={false}
    />
  );
}

// ── Legacy design renderers (kept for backward compat) ────────────────────

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

// ── Classic style — traditional pip-based cards ───────────────────────────

// Traditional pip positions as [top%, left%] within the pip area.
// The pip area sits between the two corner blocks.
const PIP_POSITIONS = {
  1:  [[50, 50]],
  2:  [[22, 50], [78, 50]],
  3:  [[22, 50], [50, 50], [78, 50]],
  4:  [[22, 22], [22, 78], [78, 22], [78, 78]],
  5:  [[22, 22], [22, 78], [50, 50], [78, 22], [78, 78]],
  6:  [[20, 22], [50, 22], [80, 22], [20, 78], [50, 78], [80, 78]],
  7:  [[18, 22], [46, 22], [74, 22], [32, 50], [18, 78], [46, 78], [74, 78]],
  8:  [[18, 22], [46, 22], [74, 22], [32, 50], [68, 50], [18, 78], [46, 78], [74, 78]],
  9:  [[13, 22], [35, 22], [57, 22], [79, 22], [50, 50], [13, 78], [35, 78], [57, 78], [79, 78]],
  10: [[13, 22], [35, 22], [57, 22], [79, 22], [26, 50], [74, 50], [13, 78], [35, 78], [57, 78], [79, 78]],
};

function ClassicStyleFace({ label, suit, colorClass, selected, rank }) {
  const isFaceCard = rank >= 11; // J, Q, K
  const isAce      = rank === 1;
  return (
    <div className={`card-face card-face--style-classic ${colorClass}${selected ? ' selected' : ''}`}>
      <div className="card-corner top">
        <span className="card-rank cs-rank">{label}</span>
        <span className="card-suit-small cs-suit-sm">{suit.symbol}</span>
      </div>

      <div className="cs-classic-body">
        {isFaceCard && (
          <div className="cs-classic-face-inner">
            <span className="cs-classic-face-rank">{label}</span>
            <span className="cs-classic-face-suit">{suit.symbol}</span>
          </div>
        )}
        {isAce && (
          <span className="cs-classic-ace">{suit.symbol}</span>
        )}
        {!isFaceCard && !isAce && (
          <div className="cs-pip-area">
            {(PIP_POSITIONS[rank] || []).map(([top, left], i) => (
              <span key={i} className="cs-pip" style={{ top: `${top}%`, left: `${left}%` }}>
                {suit.symbol}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card-corner bottom">
        <span className="card-rank cs-rank">{label}</span>
        <span className="card-suit-small cs-suit-sm">{suit.symbol}</span>
      </div>
    </div>
  );
}

// ── Modern style — bold geometric ornate cards ────────────────────────────

function ModernStyleFace({ label, suit, colorClass, selected, rank }) {
  const isFaceCard = rank >= 11;
  return (
    <div className={`card-face card-face--style-modern ${colorClass}${selected ? ' selected' : ''}`}>
      <div className="card-corner top">
        <span className="card-rank cs-modern-rank">{label}</span>
        <span className="card-suit-small">{suit.symbol}</span>
      </div>

      <div className="cs-modern-center">
        {isFaceCard ? (
          <div className="cs-modern-face-frame">
            <div className="cs-modern-face-diamond" />
            <span className="cs-modern-face-rank">{label}</span>
            <span className="cs-modern-face-suit">{suit.symbol}</span>
          </div>
        ) : (
          <div className="cs-modern-pip-frame">
            <span className="cs-modern-center-suit">{suit.symbol}</span>
            <span className="cs-modern-center-rank">{label}</span>
          </div>
        )}
      </div>

      <div className="card-corner bottom">
        <span className="card-rank cs-modern-rank">{label}</span>
        <span className="card-suit-small">{suit.symbol}</span>
      </div>
    </div>
  );
}

// ── Fantasy style — parchment arcane cards ────────────────────────────────

function FantasyStyleFace({ label, suit, colorClass, selected, rank }) {
  const isFaceCard = rank >= 11;
  const isAce      = rank === 1;
  return (
    <div className={`card-face card-face--style-fantasy ${colorClass}${selected ? ' selected' : ''}`}>
      <div className="card-corner top">
        <span className="card-rank cs-fantasy-rank">{label}</span>
        <span className="card-suit-small cs-fantasy-suit-sm">{suit.symbol}</span>
      </div>

      <div className="cs-fantasy-center">
        <div className={`cs-fantasy-ring${isFaceCard ? ' cs-fantasy-ring--face' : ''}${isAce ? ' cs-fantasy-ring--ace' : ''}`}>
          {isFaceCard
            ? <span className="cs-fantasy-face-rank">{label}</span>
            : <span className="cs-fantasy-center-suit">{suit.symbol}</span>
          }
        </div>
        {!isFaceCard && !isAce && (
          <span className="cs-fantasy-center-label">{label}</span>
        )}
      </div>

      <div className="card-corner bottom">
        <span className="card-rank cs-fantasy-rank">{label}</span>
        <span className="card-suit-small cs-fantasy-suit-sm">{suit.symbol}</span>
      </div>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────

export function Card({ card, faceUp, selected, onClick, design: designProp }) {
  const { preferences } = useContext(PreferencesContext);
  const cardStyle = preferences.cardStyle || null;
  const design    = designProp || preferences.cardFaceDesign || 'standard';

  if (!faceUp) {
    if (cardStyle === 'classic' || cardStyle === 'fantasy' || cardStyle === 'modern') {
      return (
        <div className="card-wrap" onClick={onClick}>
          <ImageBack cardStyle={cardStyle} />
        </div>
      );
    }
    const hasPattern = Boolean(preferences?.cardBackPattern);
    return (
      <div className="card-wrap" onClick={onClick}>
        <div className={`card-back${hasPattern ? ' has-pattern' : ''}`} />
      </div>
    );
  }

  const rank       = getRank(card);
  const suit       = getSuit(card);
  const label      = rankLabel(rank);
  const colorClass = suit.color;
  const faceProps  = { label, suit, colorClass, selected, rank };

  return (
    <div className="card-wrap" onClick={onClick}>
      {cardStyle === 'classic'  ? <ImageFace rank={rank} suit={suit} selected={selected} cardStyle="classic" /> :
       cardStyle === 'fantasy'  ? <ImageFace rank={rank} suit={suit} selected={selected} cardStyle="fantasy" /> :
       cardStyle === 'modern'   ? <ImageFace rank={rank} suit={suit} selected={selected} cardStyle="modern"  /> :
       design    === 'minimal'  ? <MinimalFace       {...faceProps} /> :
       design    === 'classic'  ? <ClassicFace       {...faceProps} /> :
                                  <StandardFace      {...faceProps} />}
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
