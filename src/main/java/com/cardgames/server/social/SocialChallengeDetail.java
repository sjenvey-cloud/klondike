package com.cardgames.server.social;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record SocialChallengeDetail(
    int                        id,
    UUID                       creatorUserUuid,
    String                     creatorDisplayName,
    UUID                       handUuid,
    String                     drawMode,
    String                     status,
    LocalDateTime              createdAt,
    LocalDateTime              endedAt,
    List<SocialLeaderboardEntry> leaderboard
) {}
