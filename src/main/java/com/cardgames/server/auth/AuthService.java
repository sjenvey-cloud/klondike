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

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PublicKey;
import java.security.Signature;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import java.nio.charset.StandardCharsets;

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

    // ── Game Center SSO (DEV-250) ─────────────────────────────────────────

    /**
     * Verifies the Apple Game Center ECDSA identity signature and issues a JWT pair.
     * If the teamPlayerID has never been seen before, a new user account is created.
     * Existing users are looked up via user_identities (provider='game_center').
     */
    @Transactional
    public AuthTokenPair loginWithGameCenter(GameCenterAuthRequest req) {
        verifyGkSignature(req);

        return userIdentityRepository
            .findByProviderAndProviderUserId("game_center", req.playerId())
            .map(identity -> {
                User user = userRepository.findById(identity.getUserId())
                    .orElseThrow(InvalidCredentialsException::new);
                return issueTokenPair(user);
            })
            .orElseGet(() -> {
                // New Game Center user — create account.
                // Virtual email is guaranteed unique and clearly machine-generated.
                String virtualEmail = "gc_" + req.playerId() + "@gamecenter.apple.com";
                String displayName  = (req.displayName() != null && !req.displayName().isBlank())
                    ? req.displayName()
                    : "Player_" + req.playerId().substring(Math.max(0, req.playerId().length() - 6));

                User user = new User(virtualEmail, null, displayName);
                userRepository.save(user);
                userIdentityRepository.save(new UserIdentity(user.getId(), "game_center", req.playerId()));
                return issueTokenPair(user);
            });
    }

    // ── Link Game Center to an existing account (DEV-333) ─────────────────

    /**
     * Links a verified Game Center identity to an already-authenticated user.
     * Unlike {@link #loginWithGameCenter}, this never creates a new account — it
     * attaches the GC provider to the current user so social features (Sprint iOS-8)
     * can match Game Center friends against linked accounts.
     *
     * <ul>
     *   <li>If the GC identity is unclaimed → insert a new user_identities row.</li>
     *   <li>If it already belongs to this user → no-op (idempotent).</li>
     *   <li>If it belongs to a different user → {@link GameCenterAlreadyLinkedException} (409).</li>
     * </ul>
     */
    @Transactional
    public void linkGameCenter(int userId, GameCenterAuthRequest req) {
        verifyGkSignature(req);

        userIdentityRepository
            .findByProviderAndProviderUserId("game_center", req.playerId())
            .ifPresentOrElse(
                identity -> {
                    if (identity.getUserId() != userId) {
                        throw new GameCenterAlreadyLinkedException();
                    }
                    // Same user — already linked, nothing to do (idempotent).
                },
                () -> userIdentityRepository.save(
                    new UserIdentity(userId, "game_center", req.playerId()))
            );
    }

    /**
     * Verifies the ECDSA signature returned by GKLocalPlayer
     * fetchItemsForIdentityVerificationSignature.
     *
     * Payload (concatenated, no delimiters):
     *   teamPlayerID (UTF-8) | bundleID (UTF-8) | timestamp (big-endian UInt64) | salt (raw)
     *
     * Algorithm: SHA256withECDSA using the X.509 certificate at publicKeyUrl.
     */
    private void verifyGkSignature(GameCenterAuthRequest req) {
        // 1. Validate that publicKeyUrl is on an Apple domain
        URI uri;
        try {
            uri = new URI(req.publicKeyUrl());
        } catch (URISyntaxException e) {
            throw new GameCenterSignatureException("Invalid publicKeyUrl: " + e.getMessage());
        }
        String host = uri.getHost();
        if (host == null || !host.endsWith(".apple.com")) {
            throw new GameCenterSignatureException("publicKeyUrl must be on apple.com — got: " + host);
        }

        // 2. Download the X.509 certificate
        byte[] certBytes;
        try {
            certBytes = uri.toURL().openStream().readAllBytes();
        } catch (Exception e) {
            throw new GameCenterSignatureException("Failed to download public key certificate: " + e.getMessage());
        }

        // 3. Parse certificate and extract public key
        PublicKey publicKey;
        try {
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            X509Certificate cert  = (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(certBytes));
            publicKey = cert.getPublicKey();
        } catch (Exception e) {
            throw new GameCenterSignatureException("Failed to parse public key certificate: " + e.getMessage());
        }

        // 4. Build the payload: teamPlayerID + bundleID + timestamp (BE UInt64) + salt
        byte[] payload;
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            baos.write(req.playerId().getBytes(StandardCharsets.UTF_8));
            baos.write(req.bundleId().getBytes(StandardCharsets.UTF_8));
            ByteBuffer ts = ByteBuffer.allocate(8).order(ByteOrder.BIG_ENDIAN);
            ts.putLong(req.timestamp());
            baos.write(ts.array());
            baos.write(Base64.getDecoder().decode(req.salt()));
            payload = baos.toByteArray();
        } catch (Exception e) {
            throw new GameCenterSignatureException("Failed to construct verification payload: " + e.getMessage());
        }

        // 5. Verify the signature. Apple's Game Center identity certificate carries an
        // RSA public key, so the algorithm is SHA256withRSA — the previous hardcoded
        // SHA256withECDSA throws InvalidKeyException against an RSA key (every link
        // attempt failed). Derive the algorithm from the key so it's correct whichever
        // Apple uses (RSA today; EC-safe if they ever migrate).
        try {
            String keyAlg = publicKey.getAlgorithm();              // "RSA" or "EC"
            String sigAlg = "EC".equals(keyAlg) ? "SHA256withECDSA" : "SHA256withRSA";
            Signature sig = Signature.getInstance(sigAlg);
            sig.initVerify(publicKey);
            sig.update(payload);
            boolean valid = sig.verify(Base64.getDecoder().decode(req.signature()));
            if (!valid) {
                throw new GameCenterSignatureException(
                    "Signature verification failed (sigAlg=" + sigAlg + ", keyAlg=" + keyAlg + ")");
            }
        } catch (GameCenterSignatureException e) {
            throw e;
        } catch (Exception e) {
            throw new GameCenterSignatureException("Signature verification error: " + e.getMessage());
        }
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
            (long) user.getId(), user.getUuid(), user.getEmail(), user.getDisplayName());
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
