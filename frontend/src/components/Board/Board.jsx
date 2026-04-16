import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '../Card/Card';
import { canPlaceOnTableau } from '../../services/gameLogic';
import './Board.css';

const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

export function Board({ game, timer }) {
  const {
    tableau, stock, waste, foundations, draw,
    wasteToTableau, wasteToFoundation,
    tableauToTableau, tableauToFoundation,
    canAutoComplete, autoComplete,
  } = game;

  const [selected, setSelected] = useState(null);
  // selected: { source: 'waste' | 'tableau', col?: number, idx?: number }

  // DEV-65: shake state
  const [shaking, setShaking] = useState(null); // col number | 'waste' | 'foundationN' | null

  // DEV-20: drag state
  const dragRef = useRef(null);
  // dragRef.current: { source, col?, idx?, ghost, startX, startY }

  const triggerShake = useCallback((target) => {
    setShaking(target);
    setTimeout(() => setShaking(null), 400);
  }, []);

  const clearSelected = () => setSelected(null);

  // ── Click handlers (existing + shake on invalid) ──────────────────────────

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

  const handleFoundationClick = useCallback((fi) => { // eslint-disable-line no-unused-vars
    if (!selected) return;
    if (selected.source === 'waste') {
      wasteToFoundation();
    } else if (selected.source === 'tableau') {
      tableauToFoundation(selected.col);
    }
    clearSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, wasteToFoundation, tableauToFoundation]);

  const handleTableauClick = useCallback((col, idx) => {
    const pile = tableau[col];

    // Clicking an empty col
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

    // Invalid target — shake and reselect
    triggerShake(col);
    setSelected({ source: 'tableau', col, idx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableau, waste, selected, wasteToTableau, tableauToTableau, triggerShake]);

  // ── DEV-21: Double-click to foundation ───────────────────────────────────

  const handleWasteDblClick = useCallback(() => {
    clearSelected();
    wasteToFoundation();
  }, [wasteToFoundation]);

  const handleTableauDblClick = useCallback((col, idx, e) => {
    e.stopPropagation();
    const pile = tableau[col];
    if (!pile || !pile[idx] || !pile[idx].faceUp) return;
    // Only top card
    if (idx !== pile.length - 1) return;
    clearSelected();
    tableauToFoundation(col);
  }, [tableau, tableauToFoundation]);

  // ── DEV-20: Pointer-based drag & drop ────────────────────────────────────

  const createGhost = useCallback((cardEl, clientX, clientY) => {
    const rect = cardEl.getBoundingClientRect();
    const ghost = cardEl.cloneNode(true);
    ghost.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: none;
      z-index: 999;
      opacity: 0.85;
      transform: scale(1.04);
      transition: none;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(ghost);
    return {
      ghost,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };
  }, []);

  const handleCardPointerDown = useCallback((e, source, col, idx) => {
    // Skip non-primary mouse buttons; touch/pen always allowed
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const pile = source === 'waste'
      ? (waste.length > 0 ? [waste[waste.length - 1]] : [])
      : (tableau[col] || []);
    const card = source === 'waste' ? pile[0] : pile[idx];
    if (!card || !card.faceUp) return;
    if (source === 'waste' && waste.length === 0) return;

    // Store intent — do NOT call setPointerCapture (blocks click on iOS)
    // Ghost is created lazily on first significant movement
    dragRef.current = {
      source, col, idx,
      cardEl: e.currentTarget,
      ghost: null, offsetX: 0, offsetY: 0,
      startX: e.clientX, startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
  }, [waste, tableau]);

  const handleCardPointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;

    if (!drag.moved) {
      // First movement past threshold — create ghost now
      drag.moved = true;
      const { ghost, offsetX, offsetY } = createGhost(drag.cardEl, drag.startX, drag.startY);
      drag.ghost = ghost;
      drag.offsetX = offsetX;
      drag.offsetY = offsetY;
    }
    drag.ghost.style.left = `${e.clientX - drag.offsetX}px`;
    drag.ghost.style.top  = `${e.clientY - drag.offsetY}px`;
  }, [createGhost]);

  const handleCardPointerUp = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.ghost) drag.ghost.remove();
    dragRef.current = null;

    if (!drag.moved) return; // tap — onClick fires normally, no action needed here

    // Find what element is under the pointer (ghost has pointer-events:none)
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;

    // Walk up to find data attributes set on wrappers
    const target = el.closest('[data-drop]');
    if (!target) return;

    const dropType = target.dataset.drop;
    const dropCol  = target.dataset.col !== undefined ? Number(target.dataset.col) : null;

    if (dropType === 'tableau') {
      if (drag.source === 'waste') {
        wasteToTableau(dropCol);
      } else if (drag.source === 'tableau') {
        tableauToTableau(drag.col, drag.idx, dropCol);
      }
    } else if (dropType === 'foundation') {
      if (drag.source === 'waste') {
        wasteToFoundation();
      } else if (drag.source === 'tableau') {
        tableauToFoundation(drag.col);
      }
    }
  }, [wasteToTableau, tableauToTableau, wasteToFoundation, tableauToFoundation]);

  // Attach global pointer handlers — also handle pointercancel (iOS system interrupts)
  useEffect(() => {
    const onMove   = (e) => handleCardPointerMove(e);
    const onUp     = (e) => handleCardPointerUp(e);
    const onCancel = () => {
      const drag = dragRef.current;
      if (drag?.ghost) drag.ghost.remove();
      dragRef.current = null;
    };
    window.addEventListener('pointermove',   onMove);
    window.addEventListener('pointerup',     onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove',   onMove);
      window.removeEventListener('pointerup',     onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [handleCardPointerMove, handleCardPointerUp]);

  // ── Render guard ─────────────────────────────────────────────────────────

  if (!tableau) return null;

  const wasteTop    = waste.length > 0 ? waste[waste.length - 1] : null;
  const wasteSecond = waste.length > 1 ? waste[waste.length - 2] : null;
  const wasteThird  = waste.length > 2 ? waste[waste.length - 3] : null;

  return (
    <div className="board">
      {/* Stats bar */}
      <div className="board-stats">
        <span>Moves: {game.moves}</span>
        <span>{timer?.formatted || '0:00'}</span>
        <span>{stock.length} left</span>
        {canAutoComplete && (
          <button className="autocomplete-btn" onClick={autoComplete}>
            Auto-Complete
          </button>
        )}
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
        <div
          className={`waste-area${shaking === 'waste' ? ' shake' : ''}`}
          onClick={handleWasteClick}
          onDoubleClick={handleWasteDblClick}
          data-drop="waste"
        >
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
            <div
              className={`waste-card${dragRef.current?.source === 'waste' ? ' dragging' : ''}`}
              style={{ left: waste.length > 1 ? 16 : 0 }}
              onPointerDown={(e) => handleCardPointerDown(e, 'waste', null, null)}
            >
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
          <div
            key={fi}
            className={`foundation-pile${shaking === `foundation${fi}` ? ' shake' : ''}`}
            onClick={() => handleFoundationClick(fi)}
            data-drop="foundation"
            data-fi={fi}
          >
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
          <div
            key={col}
            className={`tableau-col${shaking === col ? ' shake' : ''}`}
            data-drop="tableau"
            data-col={col}
          >
            {pile.length === 0
              ? <div className="tableau-col-empty" onClick={() => handleTableauClick(col, -1)} />
              : pile.map((c, idx) => (
                  <div
                    key={idx}
                    className={`tableau-card${idx > 0 && pile[idx - 1].faceUp ? ' face-up' : ''}${dragRef.current?.source === 'tableau' && dragRef.current?.col === col && dragRef.current?.idx === idx ? ' dragging' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleTableauClick(col, idx); }}
                    onDoubleClick={(e) => handleTableauDblClick(col, idx, e)}
                    onPointerDown={c.faceUp ? (e) => handleCardPointerDown(e, 'tableau', col, idx) : undefined}
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
