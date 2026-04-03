import React, { useState, useCallback } from 'react';
import { Card } from '../Card/Card';
import { canPlaceOnTableau } from '../../services/gameLogic';
import './Board.css';

const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

export function Board({ game, timer }) {
  const { tableau, stock, waste, foundations, draw,
          wasteToTableau, wasteToFoundation,
          tableauToTableau, tableauToFoundation } = game;

  const [selected, setSelected] = useState(null);
  // selected: { source: 'waste' | 'tableau', col?: number, idx?: number }

  const clearSelected = () => setSelected(null);

  const handleStockClick = useCallback(() => {
    clearSelected();
    draw();
  }, [draw]);

  const handleWasteClick = useCallback(() => {
    if (!waste || !waste.length) return;
    if (selected && selected.source === 'waste') {
      clearSelected();
    } else {
      setSelected({ source: 'waste' });
    }
  }, [waste, selected]);

  const handleFoundationClick = useCallback((fi) => {
    if (!selected) return;
    if (selected.source === 'waste') {
      wasteToFoundation();
    } else if (selected.source === 'tableau') {
      tableauToFoundation(selected.col);
    }
    clearSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const handleTableauClick = useCallback((col, idx) => {
    const pile = tableau[col];

    // Clicking the empty col
    if (idx === -1) {
      if (!selected) return;
      if (selected.source === 'waste') wasteToTableau(col);
      else if (selected.source === 'tableau') tableauToTableau(selected.col, selected.idx, col);
      clearSelected();
      return;
    }

    const card = pile[idx];
    if (!card.faceUp) return;

    if (!selected) {
      setSelected({ source: 'tableau', col, idx });
      return;
    }

    // Try to place selected card here — target is the card at idx (place ON TOP of it)
    // The actual target pile for canPlace is pile slice [0..idx] since the move is placing on top of idx
    if (selected.source === 'waste') {
      const top = waste[waste.length - 1];
      if (canPlaceOnTableau(top.card, pile.slice(0, idx + 1))) {
        wasteToTableau(col);
        clearSelected();
        return;
      }
    } else if (selected.source === 'tableau') {
      const selCard = tableau[selected.col][selected.idx];
      if (canPlaceOnTableau(selCard.card, pile.slice(0, idx + 1))) {
        tableauToTableau(selected.col, selected.idx, col);
        clearSelected();
        return;
      }
    }

    // Invalid target — reselect this card instead
    setSelected({ source: 'tableau', col, idx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableau, waste, selected, wasteToTableau, tableauToTableau]);

  if (!tableau) return null;

  const wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;
  const wasteSecond = waste.length > 1 ? waste[waste.length - 2] : null;
  const wasteThird = waste.length > 2 ? waste[waste.length - 3] : null;

  return (
    <div className="board">
      {/* Stats bar */}
      <div className="board-stats">
        <span>Moves: {game.moves}</span>
        <span>{timer?.formatted || '0:00'}</span>
        <span>{stock.length} left</span>
      </div>

      {/* Top row */}
      <div className="board-top">
        {/* Stock */}
        {stock.length > 0
          ? <div className="stock-pile" onClick={handleStockClick}>
              <Card card={stock[stock.length - 1].card} faceUp={false} />
            </div>
          : <div className="stock-empty" onClick={handleStockClick}>↺</div>
        }

        {/* Waste — show up to 3 fanned */}
        <div className="waste-area" onClick={handleWasteClick}>
          {wasteThird && (
            <div className="waste-card" style={{ left: 0 }}>
              <Card card={wasteThird.card} faceUp={true} />
            </div>
          )}
          {wasteSecond && (
            <div className="waste-card" style={{ left: 8 }}>
              <Card card={wasteSecond.card} faceUp={true} />
            </div>
          )}
          {wasteTop && (
            <div className="waste-card" style={{ left: waste.length > 1 ? 16 : 0 }}>
              <Card
                card={wasteTop.card}
                faceUp={true}
                selected={selected?.source === 'waste'}
              />
            </div>
          )}
          {!wasteTop && (
            <div className="stock-empty" style={{ width: 'var(--card-w)' }} />
          )}
        </div>

        <div className="board-top-spacer" />

        {/* Foundations */}
        {foundations.map((pile, fi) => (
          <div key={fi} className="foundation-pile" onClick={() => handleFoundationClick(fi)}>
            {pile.length === 0
              ? <div className="foundation-empty">{SUIT_SYMBOLS[fi]}</div>
              : <Card card={pile[pile.length - 1]} faceUp={true} />
            }
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="board-tableau">
        {tableau.map((pile, col) => (
          <div key={col} className="tableau-col">
            {pile.length === 0
              ? <div className="tableau-col-empty" onClick={() => handleTableauClick(col, -1)} />
              : pile.map((c, idx) => (
                  <div
                    key={idx}
                    className={`tableau-card${idx > 0 && pile[idx - 1].faceUp ? ' face-up' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleTableauClick(col, idx); }}
                  >
                    <Card
                      card={c.card}
                      faceUp={c.faceUp}
                      selected={selected?.source === 'tableau' && selected.col === col && selected.idx <= idx && c.faceUp}
                    />
                  </div>
                ))
            }
          </div>
        ))}
      </div>
    </div>
  );
}
