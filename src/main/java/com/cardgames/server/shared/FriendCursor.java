package com.cardgames.server.shared;

import java.time.LocalDateTime;

/**
 * Keyset cursor for the /friends list (DEV-232).
 * Encodes the (createdAt, id) of the last item on the current page so the
 * next query can continue strictly after that row.
 */
public record FriendCursor(String createdAt, int id) {

    /** Parse createdAt back to LocalDateTime for the JPQL WHERE clause. */
    public LocalDateTime createdAtDateTime() {
        return LocalDateTime.parse(createdAt);
    }
}
