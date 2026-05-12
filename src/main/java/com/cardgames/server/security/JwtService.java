package com.cardgames.server.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;

@Service
public class JwtService {

    private static final long ACCESS_TOKEN_EXPIRY_MINUTES = 15L;

    @Value("${KLONDIKE_JWT_PRIVATE_KEY}")
    private String privateKeyPem;

    @Value("${KLONDIKE_JWT_PUBLIC_KEY}")
    private String publicKeyPem;

    private RSAPrivateKey privateKey;
    private RSAPublicKey  publicKey;

    @PostConstruct
    public void init() throws Exception {
        KeyFactory kf = KeyFactory.getInstance("RSA");
        privateKey = (RSAPrivateKey) kf.generatePrivate(
            new PKCS8EncodedKeySpec(decodePem(privateKeyPem)));
        publicKey  = (RSAPublicKey)  kf.generatePublic(
            new X509EncodedKeySpec(decodePem(publicKeyPem)));
    }

    // DEV-200: generateAccessToken now includes a jti (JWT ID) UUID claim.
    // The caller is responsible for persisting the jti in Redis via JtiStore
    // immediately after calling this method (DEV-201).
    public String generateAccessToken(int userId, String email, String displayName, String jti) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(String.valueOf(userId))
            .claim("email", email)
            .claim("displayName", displayName)
            .id(jti)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(ACCESS_TOKEN_EXPIRY_MINUTES, ChronoUnit.MINUTES)))
            .signWith(privateKey, Jwts.SIG.RS256)
            .compact();
    }

    public Claims parseAndValidateToken(String token) {
        // Throws JwtException subtypes (ExpiredJwtException, MalformedJwtException, etc.)
        // on any validation failure — let callers handle these.
        return Jwts.parser()
            .verifyWith(publicKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public int extractUserId(Claims claims) {
        return Integer.parseInt(claims.getSubject());
    }

    /** DEV-201: Extract the jti claim added in DEV-200. */
    public String extractJti(Claims claims) {
        return claims.getId();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static byte[] decodePem(String pem) {
        String stripped = pem
            .replaceAll("-----BEGIN [^-]+-----", "")
            .replaceAll("-----END [^-]+-----", "")
            .replaceAll("\\s+", "");
        return Base64.getDecoder().decode(stripped);
    }
}
