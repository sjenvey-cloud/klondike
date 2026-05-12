package com.cardgames.server.auth;

import com.cardgames.server.identity.UserIdentity;
import com.cardgames.server.identity.UserIdentityRepository;
import com.cardgames.server.security.JtiStore;
import com.cardgames.server.security.JwtService;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class AuthService {

    private static final long   REFRESH_TOKEN_EXPIRY_DAYS = 7L;
    private static final String COOKIE_NAME               = "refresh_token";

    private final UserRepository         userRepository;
    private final UserIdentityRepository userIdentityRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService             jwtService;
    private final JtiStore               jtiStore;
    private final PasswordEncoder        passwordEncoder;

    public AuthService(UserRepository userRepository,
                       UserIdentityRepository userIdentityRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       JwtService jwtService,
                       JtiStore jtiStore,
                       PasswordEncoder passwordEncoder) {
        this.userRepository         = userRepository;
        this.userIdentityRepository = userIdentityRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService             = jwtService;
        this.jtiStore               = jtiStore;
        this.passwordEncoder        = passwordEncoder;
    }

    // ── Register ──────────────────────────────────────────────────────────

    @Transactional
    public AuthTokenPair register(RegisterRequest req) {
        userRepository.findByEmail(req.email()).ifPresent(u -> {
            throw new EmailAlreadyUsedException();
        });
        User user = new User(req.email(), passwordEncoder.encode(req.password()), req.displayName());
        userRepository.save(user);
        userIdentityRepository.save(new UserIdentity(user.getId(), "local", req.email()));
        return issueTokenPair(user);
    }

    // ── Login ─────────────────────────────────────────────────────────────

    public AuthTokenPair login(LoginRequest req) {
        UserIdentity identity = userIdentityRepository
            .findByProviderAndProviderUserId("local", req.email())
            .orElseThrow(InvalidCredentialsException::new);

        User user = userRepository.findById(identity.getUserId())
            .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        return issueTokenPair(user);
    }

    // ── Refresh ───────────────────────────────────────────────────────────

    @Transactional
    public AuthTokenPair refresh(String rawToken) {
        String tokenHash = sha256Hex(rawToken);

        RefreshToken token = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(InvalidTokenException::new);

        if (!token.isValid()) throw new InvalidTokenException();

        // Rotate: revoke old token before issuing new pair
        token.setRevoked(true);
        refreshTokenRepository.save(token);

        User user = userRepository.findById(token.getUserId())
            .orElseThrow(InvalidTokenException::new);

        return issueTokenPair(user);
    }

    // ── Logout ────────────────────────────────────────────────────────────

    @Transactional
    public ResponseCookie logout(String rawToken, String bearerToken) {
        String tokenHash = sha256Hex(rawToken);
        refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(t -> {
            t.setRevoked(true);
            refreshTokenRepository.save(t);
        });

        // DEV-201: revoke the jti from the accompanying access token (best-effort)
        if (bearerToken != null) {
            try {
                io.jsonwebtoken.Claims claims = jwtService.parseAndValidateToken(bearerToken);
                String jti = jwtService.extractJti(claims);
                if (jti != null) {
                    jtiStore.revoke(jti);
                }
            } catch (io.jsonwebtoken.JwtException ignored) {
                // Token already expired or invalid — jti will expire naturally in Redis
            }
        }

        return clearedCookie();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private AuthTokenPair issueTokenPair(User user) {
        String rawToken  = UUID.randomUUID().toString();
        String tokenHash = sha256Hex(rawToken);
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(REFRESH_TOKEN_EXPIRY_DAYS);

        refreshTokenRepository.save(new RefreshToken(user.getId(), tokenHash, expiresAt));

        // DEV-200/201: generate a jti and register it in Redis before returning
        String jti         = UUID.randomUUID().toString();
        String accessToken = jwtService.generateAccessToken(
            user.getId(), user.getEmail(), user.getDisplayName(), jti);
        jtiStore.store(jti);

        AuthResponse.UserDto userDto = new AuthResponse.UserDto(
            (long) user.getId(), user.getEmail(), user.getDisplayName());
        return new AuthTokenPair(accessToken, buildRefreshCookie(rawToken), userDto);
    }

    private ResponseCookie buildRefreshCookie(String rawToken) {
        return ResponseCookie.from(COOKIE_NAME, rawToken)
            .httpOnly(true)
            .secure(true)
            .sameSite("Strict")
            .path("/api/v1/auth")
            .maxAge(Duration.ofDays(REFRESH_TOKEN_EXPIRY_DAYS))
            .build();
    }

    private ResponseCookie clearedCookie() {
        return ResponseCookie.from(COOKIE_NAME, "")
            .httpOnly(true)
            .secure(true)
            .sameSite("Strict")
            .path("/api/v1/auth")
            .maxAge(0)
            .build();
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(input.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
