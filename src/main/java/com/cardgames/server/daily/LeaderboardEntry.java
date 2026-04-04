package com.cardgames.server.daily;

public record LeaderboardEntry(int rank, int userId, String displayName, int moves, int timeSeconds) {}
