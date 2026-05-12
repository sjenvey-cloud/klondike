package com.cardgames.server.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

/**
 * DEV-196: Rate-limit /api/v1/auth/** to 10 requests per minute per remote IP.
 *
 * Strategy: sliding fixed-window via Redis.
 *   Key  : rate_limit:auth:{ip}
 *   Value: integer hit count
 *   TTL  : 60 seconds (set only on first hit so the window is anchored to the
 *          first request, not reset on every request)
 *
 * Returns HTTP 429 with a Retry-After: 60 header when the limit is exceeded.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String  KEY_PREFIX   = "rate_limit:auth:";
    private static final int     MAX_REQUESTS = 10;
    private static final long    WINDOW_SECS  = 60L;
    private static final String  AUTH_PATH    = "/api/v1/auth/";

    private final StringRedisTemplate redisTemplate;

    public RateLimitFilter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(AUTH_PATH);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String ip  = resolveClientIp(request);
        String key = KEY_PREFIX + ip;

        Long count = redisTemplate.opsForValue().increment(key);

        if (count != null && count == 1L) {
            // First hit in this window — set the TTL
            redisTemplate.expire(key, Duration.ofSeconds(WINDOW_SECS));
        }

        if (count != null && count > MAX_REQUESTS) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(WINDOW_SECS));
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many requests — please wait before retrying.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Prefer the de-facto X-Forwarded-For header written by ALB/CloudFront
     * (first address is the real client); fall back to the direct remote addr.
     */
    private static String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
