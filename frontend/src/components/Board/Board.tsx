import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '../Card/Card';
import { canPlaceOnTableau, canPlaceOnFoundation, foundationIndex } from '../../services/gameLogic';
import type { UseGameReturn } from '../../hooks/useGame';
import type { UseTimerReturn } from '../../hooks/useTimer';
import './Board.css';

const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

type DragSource = 'waste' | 'tableau' | 'foundation';

interface DragState {
  source: DragSource;
  col: number | null;
  idx: number | null;
  fi: number | null;
  cardEl: HTMLElement;
  ghost: HTMLElement | null;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  moved: boolean;
  pointerId: number;
}

interface DropTarget {
  type: string;
  col: number | null;
  fi: number | null;
}

interface BoardProps {
  game: UseGameReturn;
  timer?: UseTimerReturn;
  onLeaderboard?: () => void;
  onRedeal?: () => void;
  onNewGame?: () => void;
  drawMode: string;
  stockSide?: 'left' | 'right';
}

export function Board({ game, timer, onLeaderboard, onRedeal, onNewGame, drawMode, stockSide = 'left' }: BoardProps): React.JSX.Element | null {
  const {
    tableau, stock, waste, foundations, draw,
    wasteToTableau, wasteToFoundation,
    tableauToTableau, tableauToFoundation, foundationToTableau,
    canAutoComplete, autoComplete,
    canUndo, undo,
    isWon,
  } = game;

  const [shaking, setShaking] = useState<number | string | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const [dragTarget, setDragTarget] = useState<DropTarget | null>(null);
  const dragTargetRef = useRef<DropTarget | null>(null);

  const gameStateRef = useRef({ waste, tableau, foundations });
  useEffect(() => { gameStateRef.current = { waste, tableau, foundations }; }, [waste, tableau, foundations]);

  const triggerShake = useCallback((target: number | string): void => {
    setShaking(target);
    setTimeout(() => setShaking(null), 400);
  }, []);

  const handleStockClick = useCallback((): void => {
    draw();
  }, [draw]);

  const handleWasteClick = useCallback((): void => {
    if (!waste || !waste.length) return;
    const card = waste[waste.length - 1].card;
    if (canPlaceOnFoundation(card, foundations[foundationIndex(card)])) {
      wasteToFoundation();
      return;
    }
    for (let col = 0; col < tableau.length; col++) {
      if (canPlaceOnTableau(card, tableau[col])) {
        wasteToTableau(col);
        return;
      }
    }
    triggerShake('waste');
  }, [waste, foundations, tableau, wasteToFoundation, wasteToTableau, triggerShake]);

  const handleFoundationClick = useCallback((fi: number): void => {
    if (foundations[fi].length === 0) return;
    const topCard = foundations[fi][foundations[fi].length - 1];
    for (let col = 0; col < tableau.length; col++) {
      if (canPlaceOnTableau(topCard, tableau[col])) {
        foundationToTableau(fi, col);
        return;
      }
    }
    triggerShake(`foundation${fi}`);
  }, [foundations, tableau, foundationToTableau, triggerShake]);

  const handleTableauClick = useCallback((col: number, idx: number, e: React.MouseEvent): void => {
    e.stopPropagation();
    const pile = tableau[col];
    if (!pile || !pile[idx] || !pile[idx].faceUp) return;
    const card = pile[idx].card;
    const isTop = idx === pile.length - 1;
    if (isTop && canPlaceOnFoundation(card, foundations[foundationIndex(card)])) {
      tableauToFoundation(col);
      return;
    }
    for (let toCol = 0; toCol < tableau.length; toCol++) {
      if (toCol !== col && canPlaceOnTableau(card, tableau[toCol])) {
        tableauToTableau(col, idx, toCol);
        return;
      }
    }
    triggerShake(col);
  }, [tableau, foundations, tableauToFoundation, tableauToTableau, triggerShake]);

  const resolveDropTarget = useCallback((clientX: number, clientY: number): DropTarget | null => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const node = el.closest('[data-drop]') as HTMLElement | null;
    if (!node) return null;
    return {
      type: node.dataset['drop']!,
      col:  node.dataset['col'] !== undefined ? Number(node.dataset['col']) : null,
      fi:   node.dataset['fi']  !== undefined ? Number(node.dataset['fi'])  : null,
    };
  }, []);

  const getDragCard = useCallback((): number | null => {
    const drag = dragRef.current;
    if (!drag) return null;
    const { waste: w, tableau: t, foundations: f } = gameStateRef.current;
    if (drag.source === 'waste')      return w.length > 0 ? w[w.length - 1].card : null;
    if (drag.source === 'tableau')    return t[drag.col!]?.[drag.idx!]?.card ?? null;
    if (drag.source === 'foundation') return f[drag.fi!]?.length > 0 ? f[drag.fi!][f[drag.fi!].length - 1] : null;
    return null;
  }, []);

  const isValidDropTarget = useCallback((t: DropTarget | null): boolean => {
    if (!t) return false;
    const card = getDragCard();
    if (card == null) return false;
    const drag = dragRef.current;
    const { tableau: tab, foundations: f } = gameStateRef.current;
    if (t.type === 'tableau')    return canPlaceOnTableau(card, tab[t.col!] || []);
    if (t.type === 'foundation') {
      if (!drag || drag.source === 'foundation') return false;
      return canPlaceOnFoundation(card, f[t.fi!] || []);
    }
    return false;
  }, [getDragCard]);

  const createGhost = useCallback((cardEl: HTMLElement, clientX: number, clientY: number): { ghost: HTMLElement; offsetX: number; offsetY: number } => {
    const rect = cardEl.getBoundingClientRect();
    const ghost = cardEl.cloneNode(true) as HTMLElement;
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

  const handleCardPointerDown = useCallback((
    e: React.PointerEvent,
    source: DragSource,
    col: number | null,
    idx: number | null,
    fi: number | null = null,
  ): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (source === 'foundation') {
      if (fi == null || !foundations[fi] || foundations[fi].length === 0) return;
    } else {
      const pile = source === 'waste'
        ? (waste.length > 0 ? [waste[waste.length - 1]] : [])
        : (tableau[col!] || []);
      const card = source === 'waste' ? pile[0] : pile[idx!];
      if (!card || !card.faceUp) return;
      if (source === 'waste' && waste.length === 0) return;
    }

    dragRef.current = {
      source, col, idx, fi,
      cardEl: e.currentTarget as HTMLElement,
      ghost: null, offsetX: 0, offsetY: 0,
      startX: e.clientX, startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
  }, [waste, tableau, foundations]);

  const handleCardPointerMove = useCallback((e: PointerEvent): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;

    if (!drag.moved) {
      drag.moved = true;
      const { ghost, offsetX, offsetY } = createGhost(drag.cardEl, drag.startX, drag.startY);
      drag.ghost = ghost;
      drag.offsetX = offsetX;
      drag.offsetY = offsetY;
    }
    drag.ghost!.style.left = `${e.clientX - drag.offsetX}px`;
    drag.ghost!.style.top  = `${e.clientY - drag.offsetY}px`;

    const t = resolveDropTarget(e.clientX, e.clientY);
    const valid = isValidDropTarget(t) ? t : null;
    const prev = dragTargetRef.current;
    if (valid?.type !== prev?.type || valid?.col !== prev?.col || valid?.fi !== prev?.fi) {
      dragTargetRef.current = valid;
      setDragTarget(valid);
    }
  }, [createGhost, resolveDropTarget, isValidDropTarget]);

  const handleCardPointerUp = useCallback((e: PointerEvent): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.ghost) drag.ghost.remove();
    dragRef.current = null;

    const trackedTarget = dragTargetRef.current;
    dragTargetRef.current = null;
    setDragTarget(null);

    if (!drag.moved) return;

    const dropTarget = trackedTarget ?? resolveDropTarget(e.clientX, e.clientY);
    if (!dropTarget) return;

    const { type: dropType, col: dropCol } = dropTarget;

    if (dropType === 'tableau') {
      if (drag.source === 'waste')           wasteToTableau(dropCol!);
      else if (drag.source === 'tableau')    tableauToTableau(drag.col!, drag.idx!, dropCol!);
      else if (drag.source === 'foundation') foundationToTableau(drag.fi!, dropCol!);
    } else if (dropType === 'foundation') {
      if (drag.source === 'waste')           wasteToFoundation();
      else if (drag.source === 'tableau')    tableauToFoundation(drag.col!);
    }
  }, [wasteToTableau, tableauToTableau, wasteToFoundation, tableauToFoundation, foundationToTableau, resolveDropTarget]);

  useEffect(() => {
    const onMove   = (e: PointerEvent): void => handleCardPointerMove(e);
    const onUp     = (e: PointerEvent): void => handleCardPointerUp(e);
    const onCancel = (): void => {
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

  if (!tableau?.length) return null;

  const isDraw3 = drawMode === 'draw3';
  const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 52;
  const FAN   = Math.round(cardW * 0.31);

  const wasteTop    = waste.length > 0 ? waste[waste.length - 1] : null;
  const wasteSecond = isDraw3 && waste.length > 1 ? waste[waste.length - 2] : null;
  const wasteThird  = isDraw3 && waste.length > 2 ? waste[waste.length - 3] : null;
  const wasteTopLeft = isDraw3 ? Math.min(waste.length - 1, 2) * FAN : 0;

  return (
    <div className="board">
      {/* Stats bar */}
      <div className="board-stats">
        <span className="board-stat-item">Moves: {game.moves}</span>
        <span className="board-stat-item">{timer?.formatted ?? '0:00'}</span>
        {!isWon && timer && (
          <button
            className="board-pause-btn"
            onClick={() => timer.pause()}
            aria-label="Pause game"
            title="Pause"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="2.5" y="2" width="4" height="12" rx="1.2"/>
              <rect x="9.5" y="2" width="4" height="12" rx="1.2"/>
            </svg>
          </button>
        )}
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
      <div className={`board-top${stockSide === 'right' ? ' board-top--stock-right' : ''}`}>
        {/* Stock */}
        {stock.length > 0
          ? <div className="stock-pile" onClick={handleStockClick}>
              <Card card={stock[stock.length - 1].card} faceUp={false} />
            </div>
          : <div className="stock-empty" onClick={handleStockClick}>↺</div>
        }

        {/* Waste */}
        <div
          className={`waste-area${shaking === 'waste' ? ' shake' : ''}${isDraw3 ? ' waste-area--draw3' : ''}`}
          onClick={handleWasteClick}
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
              <Card card={wasteTop.card} faceUp={true} />
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
                  <Card card={pile[pile.length - 1]} faceUp={true} />
                </div>
            }
          </div>
        ))}
      </div>

      {/* Pause overlay */}
      {timer?.isPaused && (
        <div className="pause-overlay" onClick={() => timer.resume()}>
          <div className="pause-modal" onClick={e => e.stopPropagation()}>
            <div className="pause-modal-title">Game Paused</div>
            <div className="pause-modal-stats">
              <span>{timer.formatted}</span>
              <span className="pause-modal-dot">·</span>
              <span>{game.moves} moves</span>
            </div>
            <button className="pause-modal-resume" onClick={() => timer.resume()}>
              ▶&ensp;Resume
            </button>
          </div>
        </div>
      )}

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
              ? <div className="tableau-col-empty" />
              : pile.map((c, idx) => (
                  <div
                    key={idx}
                    className={`tableau-card${idx > 0 && pile[idx - 1].faceUp ? ' face-up' : ''}${dragRef.current?.source === 'tableau' && dragRef.current?.col === col && dragRef.current?.idx === idx ? ' dragging' : ''}`}
                    onClick={(e) => handleTableauClick(col, idx, e)}
                    onPointerDown={c.faceUp ? (e) => handleCardPointerDown(e, 'tableau', col, idx) : undefined}
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
