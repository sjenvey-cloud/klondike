package com.cardgames.server.auth;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // ── DEV-75: Register ──────────────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest body,
            jakarta.servlet.http.HttpServletResponse response) {

        AuthTokenPair pair = authService.register(body);
        response.addHeader(HttpHeaders.SET_COOKIE, pair.refreshCookie().toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(pair.accessToken(), pair.user()));
    }

    // ── DEV-76: Login ─────────────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest body,
            jakarta.servlet.http.HttpServletResponse response) {

        AuthTokenPair pair = authService.login(body);
        response.addHeader(HttpHeaders.SET_COOKIE, pair.refreshCookie().toString());
        return ResponseEntity.ok(new AuthResponse(pair.accessToken(), pair.user()));
    }

    // ── DEV-77: Refresh ───────────────────────────────────────────────────

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

    // ── DEV-78: Logout ────────────────────────────────────────────────────

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

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new HashMap<>();
        e.getBindingResult().getFieldErrors()
            .forEach(fe -> errors.put(fe.getField(), fe.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }
}
