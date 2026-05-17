package com.cardgames.server.shared;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Base64;

/**
 * Encodes/decodes opaque pagination cursors as Base64-URL JSON (DEV-232).
 *
 * encode: object → JSON bytes → Base64-URL (no padding)
 * decode: Base64-URL → JSON bytes → object. Returns null on any error so callers
 *         can safely fall back to the first page rather than returning 400.
 */
public final class CursorUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private CursorUtil() {}

    public static String encode(Object obj) {
        try {
            byte[] json = MAPPER.writeValueAsBytes(obj);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(json);
        } catch (Exception e) {
            throw new IllegalStateException("Cursor encoding failed", e);
        }
    }

    public static <T> T decode(String cursor, Class<T> type) {
        if (cursor == null || cursor.isBlank()) return null;
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(cursor);
            return MAPPER.readValue(bytes, type);
        } catch (Exception e) {
            return null; // malformed cursor → caller treats as "start from beginning"
        }
    }
}
