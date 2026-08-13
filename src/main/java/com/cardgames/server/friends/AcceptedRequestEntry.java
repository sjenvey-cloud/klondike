package com.cardgames.server.friends;

import java.time.LocalDateTime;

/**
 * One accepted-but-unseen acknowledgment shown to the original requester in
 * GET /friends/requests/accepted. Cleared once the requester opens Social.
 */
public record AcceptedRequestEntry(
    int           id,
    int           acceptorId,
    String        acceptorDisplayName,
    String        acceptorLocation,    // device region, may be null
    LocalDateTime acceptedAt
) {}
