import React from 'react';
import { Card } from '../Card/Card';
import './ReplayBoard.css';

const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

/**
 * DEV-220: Read-only board for replay viewer.
 *
 * Renders the Klondike layout (stock, waste, foundations, tableau) identically
 * to Board.jsx but with no click/drag interaction. The parent controls which
 * state snapshot is displayed via props.
 *
 * Props:
 *   tableau      [{ card: number, faceUp: bool }][]  — 7 piles
 *   stock        [{ card: number, faceUp: bool }]    — index 0 = top
 *   waste        [{ card: number, faceUp: bool }]    — last element = top
 *   foundations  number[][]                          — 4 piles of card IDs
 *   drawMode     "draw1" | "draw3"
 */
export function ReplayBoard({ tableau, stock, waste, foundations, drawMode }) {
  if (!tableau) return null;

  const isDraw3 = drawMode === 'draw3';
  const cardW   = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--card-w')
  ) || 52;
  const FAN = Math.round(cardW * 0.31);

  const wasteTop    = waste.length > 0 ? waste[waste.length - 1] : null;
  const wasteSecond = isDraw3 && waste.length > 1 ? waste[waste.length - 2] : null;
  const wasteThird  = isDraw3 && waste.length > 2 ? waste[waste.length - 3] : null;
  const wasteTopLeft = isDraw3 ? Math.min(waste.length - 1, 2) * FAN : 0;

  return (
    <div className="rb-board">

      {/* ── Top row: stock | waste | spacer | foundations ── */}
      <div className="rb-top">

        {/* Stock */}
        {stock.length > 0
          ? <div className="rb-stock"><Card card={stock[stock.length - 1].card} faceUp={false} /></div>
          : <div className="rb-stock-empty">↺</div>
        }

        {/* Waste */}
        <div className={`rb-waste${isDraw3 ? ' rb-waste--draw3' : ''}`}>
          {wasteThird && (
            <div className="rb-waste-card rb-waste-card--peek" style={{ left: 0 }}>
              <Card card={wasteThird.card} faceUp={true} />
            </div>
          )}
          {wasteSecond && (
            <div className="rb-waste-card rb-waste-card--peek" style={{ left: FAN }}>
              <Card card={wasteSecond.card} faceUp={true} />
            </div>
          )}
          {wasteTop
            ? <div className="rb-waste-card" style={{ left: wasteTopLeft }}>
                <Card card={wasteTop.card} faceUp={true} />
              </div>
            : <div className="rb-waste-empty" style={{ width: 'var(--card-w)' }} />
          }
        </div>

        <div className="rb-spacer" />

        {/* Foundations */}
        {foundations.map((pile, fi) => (
          <div key={fi} className="rb-foundation">
            {pile.length === 0
              ? <div className="rb-foundation-empty">{SUIT_SYMBOLS[fi]}</div>
              : <Card card={pile[pile.length - 1]} faceUp={true} />
            }
          </div>
        ))}
      </div>

      {/* ── Tableau ── */}
      <div className="rb-tableau">
        {tableau.map((pile, col) => (
          <div key={col} className="rb-col">
            {pile.length === 0
              ? <div className="rb-col-empty" />
              : pile.map((c, idx) => (
                  <div
                    key={idx}
                    className={`rb-tableau-card${idx > 0 && pile[idx - 1].faceUp ? ' face-up' : ''}`}
                  >
                    <Card card={c.card} faceUp={c.faceUp} />
                  </div>
                ))
            }
          </div>
        ))}
      </div>
    </div>
  );
}
