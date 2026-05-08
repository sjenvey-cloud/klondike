import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '../Card/Card';
import { canPlaceOnTableau, canPlaceOnFoundation, foundationIndex } from '../../services/gameLogic';
import './Board.css';

const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

export function Board({ game, timer, onLeaderboard, onRedeal, onNewGame, drawMode }) {
  const {
    tableau, stock, waste, foundations, draw,
    wasteToTableau, wasteToFoundation,
    tableauToTableau, tableauToFoundation, foundationToTableau,
    canAutoComplete, autoComplete,
    canUndo, undo,
  } = game;

  const [selected, setSelected] = useState(null);
  // selected: { source: 'waste' | 'tableau', col?: number, idx?: number }

  // DEV-65: shake state
  const [shaking, setShaking] = useState(null); // col number | 'waste' | 'foundationN' | null

  // DEV-20: drag state
  const dragRef = useRef(null);
  // dragRef.current: { source, col?, idx?, ghost, startX, startY }

  // Drop-target tracking: updated on every pointermove, consumed on pointerup
  const [dragTarget, setDragTarget] = useState(null); // { type, col, fi } | null
  const dragTargetRef = useRef(null);

  // Current game state accessible in stable pointer callbacks
  const gameStateRef = useRef({ waste, tableau, foundations });
  useEffect(() => { gameStateRef.current = { waste, tableau, foundations }; }, [waste, tableau, foundations]);

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

  const handleFoundationClick = useCallback((fi) => {
    if (!selected) {
      // Select the top foundation card for moving back to tableau
      if (foundations[fi].length > 0) setSelected({ source: 'foundation', fi });
      return;
    }
    if (selected.source === 'foundation' && selected.fi === fi) {
      clearSelected();
      return;
    }
    if (selected.source === 'waste') {
      wasteToFoundation();
    } else if (selected.source === 'tableau') {
      tableauToFoundation(selected.col);
    }
    // foundation→foundation: ignore
    clearSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, foundations, wasteToFoundation, tableauToFoundation]);

  const handleTableauClick = useCallback((col, idx) => {
    const pile = tableau[col];

    // Clicking an empty col or the top-of-pile area
    if (idx === -1) {
      if (!selected) return;
      if (selected.source === 'waste') wasteToTableau(col);
      else if (selected.source === 'tableau') tableauToTableau(selected.col, selected.idx, col);
      else if (selected.source === 'foundation') foundationToTableau(selected.fi, col);
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
    } else if (selected.source === 'foundation') {
      const fi = selected.fi;
      const topCard = foundations[fi][foundations[fi].length - 1];
      if (canPlaceOnTableau(topCard, pile.slice(0, idx + 1))) {
        foundationToTableau(fi, col);
        clearSelected();
        return;
      }
    }

    // Invalid target — shake and reselect
    triggerShake(col);
    if (selected.source !== 'foundation') setSelected({ source: 'tableau', col, idx });
    else clearSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableau, waste, foundations, selected, wasteToTableau, tableauToTableau, foundationToTableau, triggerShake]);

  // ── DEV-21: Double-click to foundation ───────────────────────────────────

  const handleWasteDblClick = useCallback(() => {
    if (!waste || !waste.length) return;
    clearSelected();
    const card = waste[waste.length - 1].card;
    // 1. Try foundation
    if (canPlaceOnFoundation(card, foundations[foundationIndex(card)])) {
      wasteToFoundation();
      return;
    }
    // 2. Leftmost legal tableau column
    for (let col = 0; col < tableau.length; col++) {
      if (canPlaceOnTableau(card, tableau[col])) {
        wasteToTableau(col);
        return;
      }
    }
    triggerShake('waste');
  }, [waste, foundations, tableau, wasteToFoundation, wasteToTableau, triggerShake]);

  const handleTableauDblClick = useCallback((col, idx, e) => {
    e.stopPropagation();
    const pile = tableau[col];
    if (!pile || !pile[idx] || !pile[idx].faceUp) return;
    clearSelected();
    const card = pile[idx].card;
    const isTop = idx === pile.length - 1;
    // 1. Top card → try foundation
    if (isTop && canPlaceOnFoundation(card, foundations[foundationIndex(card)])) {
      tableauToFoundation(col);
      return;
    }
    // 2. Leftmost legal tableau column (skip source column)
    for (let toCol = 0; toCol < tableau.length; toCol++) {
      if (toCol !== col && canPlaceOnTableau(card, tableau[toCol])) {
        tableauToTableau(col, idx, toCol);
        return;
      }
    }
    triggerShake(col);
  }, [tableau, foundations, tableauToFoundation, tableauToTableau, triggerShake]);

  // ── DEV-20: Pointer-based drag & drop ────────────────────────────────────

  // Resolve which drop zone (if any) is under a screen coordinate
  const resolveDropTarget = useCallback((clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const node = el.closest('[data-drop]');
    if (!node) return null;
    return {
      type: node.dataset.drop,
      col:  node.dataset.col !== undefined ? Number(node.dataset.col) : null,
      fi:   node.dataset.fi  !== undefined ? Number(node.dataset.fi)  : null,
    };
  }, []);

  // Get the card currently being dragged (reads from stable refs)
  const getDragCard = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return null;
    const { waste: w, tableau: t, foundations: f } = gameStateRef.current;
    if (drag.source === 'waste')      return w.length > 0 ? w[w.length - 1].card : null;
    if (drag.source === 'tableau')    return t[drag.col]?.[drag.idx]?.card ?? null;
    if (drag.source === 'foundation') return f[drag.fi]?.length > 0 ? f[drag.fi][f[drag.fi].length - 1] : null;
    return null;
  }, []);

  // Check whether the resolved target is a legally valid drop for the card in flight
  const isValidDropTarget = useCallback((t) => {
    if (!t) return false;
    const card = getDragCard();
    if (!card) return false;
    const drag = dragRef.current;
    const { tableau: tab, foundations: f } = gameStateRef.current;
    if (t.type === 'tableau')    return canPlaceOnTableau(card, tab[t.col] || []);
    if (t.type === 'foundation') {
      if (!drag || drag.source === 'foundation') return false;
      return canPlaceOnFoundation(card, f[t.fi] || []);
    }
    return false;
  }, [getDragCard]);

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

  const handleCardPointerDown = useCallback((e, source, col, idx, fi) => {
    // Skip non-primary mouse buttons; touch/pen always allowed
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (source === 'foundation') {
      if (!foundations[fi] || foundations[fi].length === 0) return;
    } else {
      const pile = source === 'waste'
        ? (waste.length > 0 ? [waste[waste.length - 1]] : [])
        : (tableau[col] || []);
      const card = source === 'waste' ? pile[0] : pile[idx];
      if (!card || !card.faceUp) return;
      if (source === 'waste' && waste.length === 0) return;
    }

    dragRef.current = {
      source, col, idx, fi,
      cardEl: e.currentTarget,
      ghost: null, offsetX: 0, offsetY: 0,
      startX: e.clientX, startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
  }, [waste, tableau, foundations]);

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

    // Continuously track the drop target so pointerup can use the last known
    // hover position rather than where the finger happened to lift.
    // Only highlight targets where the move would be legal.
    const t = resolveDropTarget(e.clientX, e.clientY);
    const valid = isValidDropTarget(t) ? t : null;
    const prev = dragTargetRef.current;
    if (valid?.type !== prev?.type || valid?.col !== prev?.col || valid?.fi !== prev?.fi) {
      dragTargetRef.current = valid;
      setDragTarget(valid);
    }
  }, [createGhost, resolveDropTarget, isValidDropTarget]);

  const handleCardPointerUp = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.ghost) drag.ghost.remove();
    dragRef.current = null;

    // Consume the tracked target and clear the highlight
    const trackedTarget = dragTargetRef.current;
    dragTargetRef.current = null;
    setDragTarget(null);

    if (!drag.moved) return; // tap — onClick fires normally, no action needed here

    // Use the last-tracked hover target (reliable on touch); fall back to the
    // current pointer position in case the card was never dragged over a valid zone.
    const dropTarget = trackedTarget || resolveDropTarget(e.clientX, e.clientY);
    if (!dropTarget) return;

    const { type: dropType, col: dropCol } = dropTarget;

    if (dropType === 'tableau') {
      if (drag.source === 'waste')           wasteToTableau(dropCol);
      else if (drag.source === 'tableau')    tableauToTableau(drag.col, drag.idx, dropCol);
      else if (drag.source === 'foundation') foundationToTableau(drag.fi, dropCol);
    } else if (dropType === 'foundation') {
      if (drag.source === 'waste')           wasteToFoundation();
      else if (drag.source === 'tableau')    tableauToFoundation(drag.col);
      // foundation→foundation: no-op
    }
  }, [wasteToTableau, tableauToTableau, wasteToFoundation, tableauToFoundation, foundationToTableau, resolveDropTarget]);

  // Attach global pointer handlers — also handle pointercancel (iOS system interrupts)
  useEffect(() => {
    const onMove   = (e) => handleCardPointerMove(e);
    const onUp     = (e) => handleCardPointerUp(e);
    const onCancel = () => {
      const drag = dragRef.current;
      if (drag?.ghost) drag.ghost.remove();
      dragRef.current = null;
      dragTargetRef.current = null;
      setDragTarget(null);
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

  const isDraw3 = drawMode === 'draw3';
  // FAN scales proportionally with card width so the draw-3 fan looks right at any size
  const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 52;
  const FAN   = Math.round(cardW * 0.31); // ≈16px at 52px, ≈33px at 106px (iPad)

  const wasteTop    = waste.length > 0 ? waste[waste.length - 1] : null;
  const wasteSecond = isDraw3 && waste.length > 1 ? waste[waste.length - 2] : null;
  const wasteThird  = isDraw3 && waste.length > 2 ? waste[waste.length - 3] : null;

  // Top card slides right by FAN for each peeking card beneath it
  const wasteTopLeft = isDraw3 ? Math.min(waste.length - 1, 2) * FAN : 0;

  return (
    <div className="board">
      {/* Stats bar */}
      <div className="board-stats">
        <span className="board-stat-item">Moves: {game.moves}</span>
        <span className="board-stat-item">{timer?.formatted || '0:00'}</span>
        <div className="board-stat-actions">
          {canAutoComplete && (
            <button className="autocomplete-btn" onClick={autoComplete}>
              Auto
            </button>
          )}
          {canUndo && (
            <button className="board-action-btn" onClick={undo} aria-label="Undo">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 7.5A5 5 0 1 1 4 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M2.5 3v4.5H7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="board-action-label">Undo</span>
            </button>
          )}
          {onNewGame && (
            <button className="board-action-btn" onClick={onNewGame} title="New deal" aria-label="New deal">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 1h7a2 2 0 0 1 2 2v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6.5 9V7m0 0V5m0 2H4.5m2 0H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="board-action-label">New</span>
            </button>
          )}
          {onRedeal && (
            <button className="board-action-btn" onClick={onRedeal} title="Redeal this hand" aria-label="Redeal">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 8A5.5 5.5 0 0 1 13 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M13.5 8A5.5 5.5 0 0 1 3 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M11 3.5 13 5.5 11 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 8.5 3 10.5 5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="board-action-label">Redeal</span>
            </button>
          )}
          {onLeaderboard && (
            <button className="board-action-btn" onClick={onLeaderboard} title="Deal leaderboard" aria-label="Leaderboard">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="9" width="3.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="6.25" y="5" width="3.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="11.5" y="1" width="3.5" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span className="board-action-label">Board</span>
            </button>
          )}
        </div>
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

        {/* Waste — draw1: top card only; draw3: up to 3 fanned at 16 px steps */}
        <div
          className={`waste-area${shaking === 'waste' ? ' shake' : ''}${isDraw3 ? ' waste-area--draw3' : ''}`}
          onClick={handleWasteClick}
          onDoubleClick={handleWasteDblClick}
          data-drop="waste"
        >
          {wasteThird && (
            <div className="waste-card waste-card--peek" style={{ left: 0 }}>
              <Card card={wasteThird.card} faceUp={true} />
            </div>
          )}
          {wasteSecond && (
            <div className="waste-card waste-card--peek" style={{ left: FAN }}>
              <Card card={wasteSecond.card} faceUp={true} />
            </div>
          )}
          {wasteTop && (
            <div
              className={`waste-card${dragRef.current?.source === 'waste' ? ' dragging' : ''}`}
              style={{ left: wasteTopLeft }}
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
            className={`foundation-pile${shaking === `foundation${fi}` ? ' shake' : ''}${dragTarget?.type === 'foundation' && dragTarget?.fi === fi ? ' drop-target' : ''}`}
            onClick={() => handleFoundationClick(fi)}
            data-drop="foundation"
            data-fi={fi}
          >
            {pile.length === 0
              ? <div className="foundation-empty">{SUIT_SYMBOLS[fi]}</div>
              : <div
                  onPointerDown={(e) => handleCardPointerDown(e, 'foundation', null, null, fi)}
                  style={{ lineHeight: 0 }}
                >
                  <Card
                    card={pile[pile.length - 1]}
                    faceUp={true}
                    selected={selected?.source === 'foundation' && selected.fi === fi}
                  />
                </div>
            }
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="board-tableau">
        {tableau.map((pile, col) => (
          <div
            key={col}
            className={`tableau-col${shaking === col ? ' shake' : ''}${dragTarget?.type === 'tableau' && dragTarget?.col === col ? ' drop-target' : ''}`}
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
