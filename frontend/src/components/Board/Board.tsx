import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card } from '../Card/Card';
import {
  canPlaceOnTableau, canPlaceOnFoundation, foundationIndex,
  getRank, getSuit, rankLabel,
} from '../../services/gameLogic';
import type { UseGameReturn } from '../../hooks/useGame';
import type { UseTimerReturn } from '../../hooks/useTimer';
import './Board.css';

const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

type DragSource = 'waste' | 'tableau' | 'foundation';

// ── Keyboard navigation types ────────────────────────────────────────────────
interface KbHeld {
  source: DragSource;
  col: number | null;
  idx: number | null;
  fi: number | null;
}
type KbTarget = { type: 'tableau'; col: number } | { type: 'foundation'; fi: number };

function cardLabel(card: number): string {
  return `${rankLabel(getRank(card))} of ${getSuit(card).name}`;
}
// ────────────────────────────────────────────────────────────────────────────

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

  // Auto-complete modal (canonical web/iOS behaviour): pops once the board is
  // cleared and the deck is down to its face-up cards.
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const [autoOffered, setAutoOffered] = useState(false);
  useEffect(() => {
    if (canAutoComplete && !autoOffered) {
      setAutoOffered(true);
      setShowAutoComplete(true);
    } else if (!canAutoComplete) {
      setAutoOffered(false);   // left the end-state; allow a fresh prompt later
    }
  }, [canAutoComplete, autoOffered]);

  // Pause modal: auto-focus the Resume button when game pauses
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (timer?.isPaused) resumeBtnRef.current?.focus();
  }, [timer?.isPaused]);

  // Win announcement for screen readers
  const winAnnouncement = useMemo(
    () => isWon ? `You win! ${game.moves} move${game.moves !== 1 ? 's' : ''}${timer ? ` in ${timer.formatted}` : ''}.` : '',
    [isWon, game.moves, timer]
  );

  const dragRef = useRef<DragState | null>(null);
  const [dragTarget, setDragTarget] = useState<DropTarget | null>(null);
  const dragTargetRef = useRef<DropTarget | null>(null);

  const gameStateRef = useRef({ waste, tableau, foundations });
  useEffect(() => { gameStateRef.current = { waste, tableau, foundations }; }, [waste, tableau, foundations]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const [kbHeld,         setKbHeld]         = useState<KbHeld | null>(null);
  const [kbTargetCursor, setKbTargetCursor] = useState(0);
  const [kbAnnounce,     setKbAnnounce]     = useState('');
  const kbOriginRef = useRef<HTMLElement | null>(null);

  const kbValidTargets = useMemo((): KbTarget[] => {
    if (!kbHeld) return [];
    let card: number | null = null;
    if (kbHeld.source === 'waste') {
      card = waste.length > 0 ? waste[waste.length - 1].card : null;
    } else if (kbHeld.source === 'tableau') {
      card = tableau[kbHeld.col!]?.[kbHeld.idx!]?.card ?? null;
    } else if (kbHeld.source === 'foundation') {
      const fp = foundations[kbHeld.fi!];
      card = fp && fp.length > 0 ? fp[fp.length - 1] : null;
    }
    if (card == null) return [];
    const targets: KbTarget[] = [];
    for (let c = 0; c < tableau.length; c++) {
      if (kbHeld.source === 'tableau' && c === kbHeld.col) continue;
      if (canPlaceOnTableau(card, tableau[c])) targets.push({ type: 'tableau', col: c });
    }
    if (kbHeld.source !== 'foundation') {
      const fi = foundationIndex(card);
      if (canPlaceOnFoundation(card, foundations[fi])) targets.push({ type: 'foundation', fi });
    }
    return targets;
  }, [kbHeld, waste, tableau, foundations]);

  // When kbHeld becomes non-null, auto-focus the first valid target
  useEffect(() => {
    if (!kbHeld) return;
    if (!kbValidTargets.length) {
      setKbAnnounce('No valid moves. Press Escape to cancel.');
      return;
    }
    setKbTargetCursor(0);
    const t = kbValidTargets[0];
    const sel = t.type === 'foundation'
      ? `[data-kb-zone="foundation-${t.fi}"]`
      : `[data-kb-zone="tableau-${t.col}"]`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbHeld]);

  const kbPickUp = useCallback((
    source: DragSource, col: number | null, idx: number | null, fi: number | null = null,
  ): void => {
    kbOriginRef.current = document.activeElement as HTMLElement | null;
    setKbHeld({ source, col, idx, fi });
    setKbTargetCursor(0);
    let card: number | null = null;
    if (source === 'waste') card = waste[waste.length - 1]?.card ?? null;
    else if (source === 'tableau') card = tableau[col!]?.[idx!]?.card ?? null;
    else if (source === 'foundation') { const fp = foundations[fi!]; card = fp && fp.length > 0 ? fp[fp.length - 1] : null; }
    setKbAnnounce(card != null
      ? `Picked up ${cardLabel(card)}. Arrow keys to select target, Space or Enter to place, Escape to cancel.`
      : '');
  }, [waste, tableau, foundations]);

  const kbCancelHold = useCallback((): void => {
    setKbHeld(null);
    setKbTargetCursor(0);
    setKbAnnounce('Move cancelled');
    requestAnimationFrame(() => kbOriginRef.current?.focus());
  }, []);

  const kbDrop = useCallback((target: KbTarget): void => {
    if (!kbHeld) return;
    if (target.type === 'tableau') {
      if (kbHeld.source === 'waste')           wasteToTableau(target.col);
      else if (kbHeld.source === 'tableau')    tableauToTableau(kbHeld.col!, kbHeld.idx!, target.col);
      else if (kbHeld.source === 'foundation') foundationToTableau(kbHeld.fi!, target.col);
    } else {
      if (kbHeld.source === 'waste')        wasteToFoundation();
      else if (kbHeld.source === 'tableau') tableauToFoundation(kbHeld.col!);
    }
    setKbAnnounce('Card placed');
    setKbHeld(null);
    setKbTargetCursor(0);
  }, [kbHeld, wasteToTableau, tableauToTableau, foundationToTableau, wasteToFoundation, tableauToFoundation]);

  const kbCycleTarget = useCallback((dir: 1 | -1): void => {
    if (!kbValidTargets.length) return;
    const next = (kbTargetCursor + dir + kbValidTargets.length) % kbValidTargets.length;
    setKbTargetCursor(next);
    const t = kbValidTargets[next];
    setKbAnnounce(t.type === 'foundation' ? `Foundation ${t.fi + 1}` : `Column ${t.col + 1}`);
    const sel = t.type === 'foundation'
      ? `[data-kb-zone="foundation-${t.fi}"]`
      : `[data-kb-zone="tableau-${t.col}"]`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
  }, [kbValidTargets, kbTargetCursor]);

  const kbDropCurrent = useCallback((): void => {
    if (!kbHeld || !kbValidTargets.length) return;
    kbDrop(kbValidTargets[kbTargetCursor] ?? kbValidTargets[0]);
  }, [kbHeld, kbValidTargets, kbTargetCursor, kbDrop]);

  const handleBoardKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (!kbHeld) return;
    switch (e.key) {
      case 'Escape':      e.preventDefault(); kbCancelHold();   break;
      case 'ArrowLeft':
      case 'ArrowUp':     e.preventDefault(); kbCycleTarget(-1); break;
      case 'ArrowRight':
      case 'ArrowDown':   e.preventDefault(); kbCycleTarget(1);  break;
      case ' ':
      case 'Enter':       e.preventDefault(); kbDropCurrent();   break;
    }
  }, [kbHeld, kbCancelHold, kbCycleTarget, kbDropCurrent]);
  // ────────────────────────────────────────────────────────────────────────────

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
  const FAN   = Math.round(cardW * 0.46);

  const wasteTop    = waste.length > 0 ? waste[waste.length - 1] : null;
  const wasteSecond = isDraw3 && waste.length > 1 ? waste[waste.length - 2] : null;
  const wasteThird  = isDraw3 && waste.length > 2 ? waste[waste.length - 3] : null;
  // Each card's left offset = its rank from the top clamped to its max slot.
  // rank 1 (top):    min(waste-1, 2) * FAN  →  0 | FAN | 2×FAN
  // rank 2 (second): min(waste-2, 1) * FAN  →  0 | FAN          (fixes 2-card case where both
  //                                                                previously landed on FAN)
  // rank 3 (third):  always 0
  const wasteTopLeft    = isDraw3 ? Math.min(waste.length - 1, 2) * FAN : 0;
  const wasteSecondLeft = isDraw3 ? Math.min(waste.length - 2, 1) * FAN : 0;

  return (
    <div className="board" onKeyDown={handleBoardKeyDown}>
      {/* Screen-reader win announcement */}
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {winAnnouncement}
      </div>
      {/* Screen-reader keyboard-navigation status */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {kbAnnounce}
      </div>

      {/* Stats bar */}
      <div className="board-stats">
        <div aria-live="polite" aria-atomic="true" className="board-stat-item">
          <span className="sr-only">Moves: </span>{game.moves}
        </div>
        <span className="board-stat-item" aria-label={`Time: ${timer?.formatted ?? '0:00'}`}>
          {timer?.formatted ?? '0:00'}
        </span>
        {!isWon && timer && (
          <button
            className="board-pause-btn"
            onClick={() => { timer.pause(); game.saveProgress(timer.elapsed); }}
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
      <div
        className={`board-top${stockSide === 'right' ? ' board-top--stock-right' : ''}`}
        role="region"
        aria-label="Stock, waste, and foundations"
      >
        {/* Stock */}
        {stock.length > 0
          ? <button
              className="stock-pile"
              onClick={handleStockClick}
              aria-label="Draw from stock"
            >
              <Card card={stock[stock.length - 1].card} faceUp={false} />
            </button>
          : <button
              className="stock-empty"
              onClick={handleStockClick}
              aria-label="Recycle stock pile"
            >
              {/* aria-hidden: ↺ is decorative; label above serves as the accessible name */}
              <span aria-hidden="true">↺</span>
            </button>
        }

        {/* Waste */}
        <div
          className={`waste-area${shaking === 'waste' ? ' shake' : ''}${isDraw3 ? ' waste-area--draw3' : ''}`}
          data-drop="waste"
          role="region"
          aria-label="Waste pile"
        >
          {wasteThird && (
            <div className="waste-card waste-card--peek" style={{ left: 0 }}>
              <Card card={wasteThird.card} faceUp={true} />
            </div>
          )}
          {wasteSecond && (
            <div className="waste-card waste-card--peek" style={{ left: wasteSecondLeft }}>
              <Card card={wasteSecond.card} faceUp={true} />
            </div>
          )}
          {wasteTop && (
            <div
              className={`waste-card${dragRef.current?.source === 'waste' ? ' dragging' : ''}${kbHeld?.source === 'waste' ? ' kb-held' : ''}`}
              style={{ left: wasteTopLeft }}
              tabIndex={0}
              role="button"
              data-kb-zone="waste"
              aria-label={`${cardLabel(wasteTop.card)} in waste. Press Space or Enter to pick up.`}
              onClick={handleWasteClick}
              onPointerDown={(e) => handleCardPointerDown(e, 'waste', null, null)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!kbHeld) kbPickUp('waste', null, null);
                }
              }}
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
        {foundations.map((pile, fi) => {
          const isKbTarget = kbHeld != null
            && kbValidTargets[kbTargetCursor]?.type === 'foundation'
            && kbValidTargets[kbTargetCursor].fi === fi;
          return (
            <div
              key={fi}
              role="region"
              aria-label={`Foundation ${fi + 1}${pile.length > 0 ? ` — ${SUIT_SYMBOLS[fi]}` : ` — empty`}`}
              tabIndex={0}
              data-kb-zone={`foundation-${fi}`}
              className={`foundation-pile${shaking === `foundation${fi}` ? ' shake' : ''}${dragTarget?.type === 'foundation' && dragTarget?.fi === fi ? ' drop-target' : ''}${isKbTarget ? ' kb-target' : ''}${kbHeld?.source === 'foundation' && kbHeld.fi === fi ? ' kb-held' : ''}`}
              onClick={() => handleFoundationClick(fi)}
              data-drop="foundation"
              data-fi={fi}
              onFocus={() => {
                if (!kbHeld) return;
                const idx = kbValidTargets.findIndex(t => t.type === 'foundation' && t.fi === fi);
                if (idx >= 0) setKbTargetCursor(idx);
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (kbHeld) {
                    const t = kbValidTargets.find(t => t.type === 'foundation' && t.fi === fi);
                    if (t) kbDrop(t);
                  } else if (pile.length > 0) {
                    kbPickUp('foundation', null, null, fi);
                  }
                }
              }}
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
          );
        })}
      </div>

      {/* Pause overlay */}
      {timer?.isPaused && (
        <div
          className="pause-overlay"
          onClick={() => timer.resume()}
          onKeyDown={(e) => { if (e.key === 'Escape') timer.resume(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-dialog-title"
            className="pause-modal"
            onClick={e => e.stopPropagation()}
          >
            <div id="pause-dialog-title" className="pause-modal-title">Game Paused</div>
            <div className="pause-modal-stats">
              <span>{timer.formatted}</span>
              <span className="pause-modal-dot" aria-hidden="true">·</span>
              <span>{game.moves} moves</span>
            </div>
            <button ref={resumeBtnRef} className="pause-modal-resume" onClick={() => timer.resume()}>
              <span aria-hidden="true">▶</span>&ensp;Resume
            </button>
          </div>
        </div>
      )}

      {/* Auto-complete prompt — shared canonical behaviour with iOS */}
      {showAutoComplete && (
        <div
          className="pause-overlay"
          onClick={() => setShowAutoComplete(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowAutoComplete(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="autocomplete-dialog-title"
            className="pause-modal"
            onClick={e => e.stopPropagation()}
          >
            <div id="autocomplete-dialog-title" className="pause-modal-title">Board Cleared!</div>
            <div className="pause-modal-stats">All piles are clear — auto-complete the remaining cards?</div>
            <div className="autocomplete-modal-actions">
              <button
                className="pause-modal-resume"
                onClick={() => { setShowAutoComplete(false); autoComplete(); }}
              >
                <span aria-hidden="true">✨</span>&ensp;Auto-Complete
              </button>
              <button
                className="autocomplete-modal-cancel"
                onClick={() => setShowAutoComplete(false)}
              >
                Keep Playing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="board-tableau" role="region" aria-label="Tableau">
        {tableau.map((pile, col) => {
          const isColKbTarget = kbHeld != null
            && kbValidTargets[kbTargetCursor]?.type === 'tableau'
            && kbValidTargets[kbTargetCursor].col === col;
          const topIdx = pile.length - 1;

          // onFocus for a zone during hold: sync cursor to this column
          const syncCursorToCol = (): void => {
            if (!kbHeld) return;
            const idx = kbValidTargets.findIndex(t => t.type === 'tableau' && t.col === col);
            if (idx >= 0) setKbTargetCursor(idx);
          };

          return (
            <div
              key={col}
              role="region"
              aria-label={`Column ${col + 1}${pile.length === 0 ? ' — empty' : ` — ${pile.length} card${pile.length !== 1 ? 's' : ''}`}`}
              className={`tableau-col${shaking === col ? ' shake' : ''}${dragTarget?.type === 'tableau' && dragTarget?.col === col ? ' drop-target' : ''}${isColKbTarget ? ' kb-target' : ''}`}
              data-drop="tableau"
              data-col={col}
            >
              {pile.length === 0
                ? <div
                    className="tableau-col-empty"
                    tabIndex={0}
                    data-kb-zone={`tableau-${col}`}
                    aria-label={`Column ${col + 1}, empty. ${kbHeld ? 'Press Space or Enter to place here.' : ''}`}
                    onFocus={syncCursorToCol}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (kbHeld) {
                          const t = kbValidTargets.find(t => t.type === 'tableau' && t.col === col);
                          if (t) kbDrop(t);
                        }
                      }
                    }}
                  />
                : pile.map((c, idx) => {
                    const isTop = idx === topIdx;
                    const isKbHeldCard = kbHeld?.source === 'tableau'
                      && kbHeld.col === col && kbHeld.idx === idx;
                    // Top face-up card is the tab-stop for this column; others reachable via arrow keys
                    const tabIdx: number | undefined = c.faceUp
                      ? (isTop ? 0 : -1)
                      : undefined;

                    return (
                      <div
                        key={idx}
                        className={`tableau-card${idx > 0 && pile[idx - 1].faceUp ? ' face-up' : ''}${dragRef.current?.source === 'tableau' && dragRef.current?.col === col && dragRef.current?.idx === idx ? ' dragging' : ''}${isKbHeldCard ? ' kb-held' : ''}`}
                        onClick={(e) => handleTableauClick(col, idx, e)}
                        onPointerDown={c.faceUp ? (e) => handleCardPointerDown(e, 'tableau', col, idx) : undefined}
                        tabIndex={tabIdx}
                        data-kb-zone={isTop && c.faceUp ? `tableau-${col}` : undefined}
                        aria-label={c.faceUp ? `${cardLabel(c.card)}, column ${col + 1}` : undefined}
                        onFocus={c.faceUp ? syncCursorToCol : undefined}
                        onKeyDown={c.faceUp ? (e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (kbHeld) {
                              const t = kbValidTargets.find(t => t.type === 'tableau' && t.col === col);
                              if (t) kbDrop(t);
                            } else {
                              kbPickUp('tableau', col, idx);
                            }
                          }
                        } : undefined}
                      >
                        <Card card={c.card} faceUp={c.faceUp} />
                      </div>
                    );
                  })
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}
