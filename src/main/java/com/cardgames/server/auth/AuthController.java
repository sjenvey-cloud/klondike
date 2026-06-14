package com.cardgames.server.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Tag(name = "Authentication", description = "Register, login, refresh token, and logout")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // ── DEV-75: Register ──────────────────────────────────────────────────

    @Operation(summary = "Register a new account", description = "Creates a user, returns an access token and sets the refresh_token cookie.")
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest body,
            jakarta.servlet.http.HttpServletResponse response) {

        AuthTokenPair pair = authService.register(body);
        response.addHeader(HttpHeaders.SET_COOKIE, pair.refreshCookie().toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(pair.accessToken(), pair.user()));
    }

    // ── DEV-76: Login ─────────────────────────────────────────────────────

    @Operation(summary = "Login with email and password")
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest body,
            jakarta.servlet.http.HttpServletResponse response) {

        AuthTokenPair pair = authService.login(body);
        response.addHeader(HttpHeaders.SET_COOKIE, pair.refreshCookie().toString());
        return ResponseEntity.ok(new AuthResponse(pair.accessToken(), pair.user()));
    }

    // ── DEV-77: Refresh ───────────────────────────────────────────────────

    @Operation(summary = "Exchange refresh_token cookie for a new access token")
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = "refresh_token", required = false) String rawToken,
            jakarta.servlet.http.HttpServletResponse response) {

        if (rawToken == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        AuthTokenPair pair = authService.refresh(rawToken);
        response.addHeader(HttpHeaders.SET_COOKIE, pair.refreshCookie().toString());
        return ResponseEntity.ok(new AuthResponse(pair.accessToken(), pair.user()));
    }

    // ── DEV-250: Game Center SSO ──────────────────────────────────────────

    @Operation(
        summary     = "Sign in with Game Center",
        description = "Verifies the GKLocalPlayer ECDSA identity signature and returns a JWT pair. "
                    + "Creates a new account if the teamPlayerID is not yet registered.")
    @PostMapping("/game-center")
    public ResponseEntity<AuthResponse> gameCenter(
            @Valid @RequestBody GameCenterAuthRequest body,
            jakarta.servlet.http.HttpServletResponse response) {

        AuthTokenPair pair = authService.loginWithGameCenter(body);
        response.addHeader(HttpHeaders.SET_COOKIE, pair.refreshCookie().toString());
        return ResponseEntity.ok(new AuthResponse(pair.accessToken(), pair.user()));
    }

    // ── DEV-333: Link Game Center to the authenticated account ────────────

    @Operation(
        summary     = "Link a Game Center identity to the signed-in account",
        description = "Authenticated. Verifies the GKLocalPlayer ECDSA signature and attaches the "
                    + "Game Center provider to the current user. 409 if the Game Center account is "
                    + "already linked to a different user. Idempotent if already linked to this user.")
    @PostMapping("/game-center/link")
    public ResponseEntity<Void> linkGameCenter(
            @Valid @RequestBody GameCenterAuthRequest body,
            org.springframework.security.core.Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        authService.linkGameCenter(userId, body);
        return ResponseEntity.noContent().build();
    }

    // ── DEV-78: Logout ────────────────────────────────────────────────────

    @Operation(summary = "Revoke refresh token and invalidate access token JTI")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = "refresh_token", required = false) String rawToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            jakarta.servlet.http.HttpServletResponse response) {

        // DEV-201: extract the bearer token so AuthService can revoke its jti
        String bearerToken = (authHeader != null && authHeader.startsWith("Bearer "))
            ? authHeader.substring(7) : null;

        if (rawToken != null) {
            response.addHeader(HttpHeaders.SET_COOKIE,
                authService.logout(rawToken, bearerToken).toString());
        }
        return ResponseEntity.noContent().build();
    }

    // ── Exception handlers ────────────────────────────────────────────────

    @ExceptionHandler(EmailAlreadyUsedException.class)
    public ResponseEntity<Map<String, String>> handleEmailTaken(EmailAlreadyUsedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentials(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<Map<String, String>> handleBadToken(InvalidTokenException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(GameCenterSignatureException.class)
    public ResponseEntity<Map<String, String>> handleBadGkSignature(GameCenterSignatureException e) {
        // Log the precise reason — these are otherwise invisible (the client only sees
        // a generic failure). 422 (not 401) so the client's token-refresh-on-401 logic
        // doesn't mistake a signature rejection for an expired access token.
        log.warn("Game Center signature verification failed: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(GameCenterAlreadyLinkedException.class)
    public ResponseEntity<Map<String, String>> handleGcAlreadyLinked(GameCenterAlreadyLinkedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new HashMap<>();
        e.getBindingResult().getFieldErrors()
            .forEach(fe -> errors.put(fe.getField(), fe.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }
}
