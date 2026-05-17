package com.cardgames.server.shared;

import java.util.List;

/**
 * Generic cursor-paginated response envelope (DEV-232).
 *
 * @param items      The current page of results.
 * @param nextCursor Opaque Base64-URL-encoded cursor for the next page, or null on the last page.
 * @param hasMore    True when another page exists after this one.
 */
public record PagedResponse<T>(List<T> items, String nextCursor, boolean hasMore) {}
