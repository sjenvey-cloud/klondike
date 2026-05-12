package com.cardgames.server.security;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * DEV-201: Redis-backed store for JWT jti (JWT ID) claims.
 *
 * Protocol:
 *   Issue   — SET jti:{jti} 1 EX 900  (TTL matches the 15-min access token)
 *   Verify  — EXISTS jti:{jti}         (absent means revoked or never issued)
 *   Revoke  — DEL jti:{jti}
 */
@Service
public class JtiStore {

    /** Must match ACCESS_TOKEN_EXPIRY_MINUTES in JwtService (15 min = 900 s). */
    private static final long   ACCESS_TOKEN_SECS = 900L;
    private static final String KEY_PREFIX        = "jti:";

    private final StringRedisTemplate redisTemplate;

    public JtiStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /** Called by AuthService immediately after generating an access token. */
    public void store(String jti) {
        redisTemplate.opsForValue().set(key(jti), "1", Duration.ofSeconds(ACCESS_TOKEN_SECS));
    }

    /** Returns {@code true} if the jti is present (i.e. the token is still valid). */
    public boolean isValid(String jti) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(key(jti)));
    }

    /** Called on logout and account deletion to immediately invalidate the token. */
    public void revoke(String jti) {
        redisTemplate.delete(key(jti));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String key(String jti) {
        return KEY_PREFIX + jti;
    }
}
