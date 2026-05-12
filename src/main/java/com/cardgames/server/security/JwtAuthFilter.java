package com.cardgames.server.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    private final JwtService jwtService;
    private final JtiStore   jtiStore;

    public JwtAuthFilter(JwtService jwtService, JtiStore jtiStore) {
        this.jwtService = jwtService;
        this.jtiStore   = jtiStore;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        try {
            Claims claims = jwtService.parseAndValidateToken(token);

            // DEV-201: Reject tokens whose jti has been revoked (logout / account deletion).
            // Fail open on Redis outage — a blip must not lock out all users.
            String jti = jwtService.extractJti(claims);
            try {
                if (jti == null || !jtiStore.isValid(jti)) {
                    chain.doFilter(request, response);
                    return;
                }
            } catch (RuntimeException redisEx) {
                log.warn("JtiStore unavailable — allowing request through (fail-open): {}", redisEx.getMessage());
            }

            int userId = jwtService.extractUserId(claims);

            UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(auth);

        } catch (JwtException e) {
            // Invalid / expired token — do not set auth; Security will return 401
        }

        chain.doFilter(request, response);
    }
}
