package com.cardgames.server.profile;

import com.cardgames.server.auth.InvalidCredentialsException;
import com.cardgames.server.security.JtiStore;
import com.cardgames.server.security.JwtService;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountService {

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService      jwtService;
    private final JtiStore        jtiStore;

    public AccountService(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService,
                          JtiStore jtiStore) {
        this.userRepository  = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService      = jwtService;
        this.jtiStore        = jtiStore;
    }

    // ── Change password ───────────────────────────────────────────────────────

    @Transactional
    public void changePassword(int userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // ── Delete account ────────────────────────────────────────────────────────
    // Verifies the password then deletes the user row. All related data is
    // removed via the ON DELETE CASCADE constraints added in V14.
    // DEV-201: the caller supplies the raw bearer token so this method can
    // revoke the jti immediately rather than waiting for Redis TTL expiry.

    @Transactional
    public void deleteAccount(int userId, String password, String bearerToken) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        // Revoke jti before soft-deleting so in-flight requests are rejected immediately
        if (bearerToken != null) {
            try {
                Claims claims = jwtService.parseAndValidateToken(bearerToken);
                String jti    = jwtService.extractJti(claims);
                if (jti != null) {
                    jtiStore.revoke(jti);
                }
            } catch (JwtException ignored) {
                // Best-effort — proceed with deletion regardless
            }
        }

        // DEV-204: soft-delete — anonymise PII and set deleted_at.
        // The user row is retained for 30 days then hard-purged by UserPurgeJob.
        user.setEmail("deleted_" + userId + "@deleted.invalid");
        user.setUsername("Deleted User");
        user.setDisplayName("Deleted User");
        user.setPasswordHash("");
        user.setDeletedAt(java.time.LocalDateTime.now());
        userRepository.save(user);
    }
}
