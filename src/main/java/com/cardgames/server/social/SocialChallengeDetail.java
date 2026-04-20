package com.cardgames.server.social;

import java.time.LocalDateTime;
import java.util.List;

public record SocialChallengeDetail(
    int                        id,
    int                        creatorUserId,
    String                     creatorDisplayName,
    int                        handId,
    String                     drawMode,
    String                     status,
    LocalDateTime              createdAt,
    LocalDateTime              endedAt,
    List<SocialLeaderboardEntry> leaderboard
) {}
