package com.cardgames.server.shared;

/**
 * Offset-based cursor for leaderboard endpoints (DEV-232).
 * Leaderboard data is sorted by moves/time — keyset pagination would require
 * composite tie-breaking logic across all sort modes, so offset is simpler and
 * correct for lists that change infrequently during a session.
 */
public record OffsetCursor(int offset) {}
