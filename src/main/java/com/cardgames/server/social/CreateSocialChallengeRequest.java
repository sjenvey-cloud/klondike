package com.cardgames.server.social;

import java.util.List;
import java.util.UUID;

/**
 * Request body for POST /api/v1/social/challenges.
 *
 * invitedUserIds  — explicit list of user IDs to invite; if null, falls back to all friends.
 * invitedLeagueIds — league IDs whose members are expanded and merged into the invite set.
 */
public record CreateSocialChallengeRequest(
    UUID sessionUuid,
    List<Integer> invitedUserIds,
    List<Integer> invitedLeagueIds
) {}
