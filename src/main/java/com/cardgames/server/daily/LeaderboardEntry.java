package com.cardgames.server.daily;

import java.util.UUID;

public record LeaderboardEntry(int rank, UUID userUuid, String displayName, int moves, int timeSeconds, UUID sessionUuid) {}
