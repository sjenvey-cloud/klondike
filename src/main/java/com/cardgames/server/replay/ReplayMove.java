package com.cardgames.server.replay;

/**
 * DEV-219: One parsed move in a session replay.
 *
 * All positional fields are nullable — only the fields relevant to a given
 * type are populated:
 *
 *   draw  → (no extra fields)
 *   wt    → col   (target tableau column, 0-based)
 *   wf    → (no extra fields)
 *   tt    → fromCol, fromIdx (may be null for legacy tokens), toCol
 *   tf    → fromCol (source tableau column)
 *   ft    → fi (foundation index 0-3), toCol
 */
public record ReplayMove(
    String  type,
    Integer col,       // wt: target column
    Integer fromCol,   // tt: source column; tf: source column
    Integer fromIdx,   // tt: explicit stack start index (null for legacy tt:from:to tokens)
    Integer toCol,     // tt / ft: destination column
    Integer fi         // ft: foundation pile index (0=clubs 1=diamonds 2=hearts 3=spades)
) {}
