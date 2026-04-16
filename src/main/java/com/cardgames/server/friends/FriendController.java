package com.cardgames.server.friends;

import com.cardgames.server.session.SessionRepository;
import com.cardgames.server.user.User;
import com.cardgames.server.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.beans.factory.annotation.Value;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/friends")
public class FriendController {

    @Value("${app.base-url}")
    private String appBaseUrl;

    private final FriendRepository       friendRepository;
    private final FriendInviteRepository inviteRepository;
    private final UserRepository         userRepository;
    private final SessionRepository      sessionRepository;

    public FriendController(FriendRepository friendRepository,
                            FriendInviteRepository inviteRepository,
                            UserRepository userRepository,
                            SessionRepository sessionRepository) {
        this.friendRepository = friendRepository;
        this.inviteRepository  = inviteRepository;
        this.userRepository    = userRepository;
        this.sessionRepository = sessionRepository;
    }

    // ── DEV-155: POST /api/v1/friends/invite ─────────────────────────────

    @PostMapping("/invite")
    public ResponseEntity<InviteResponse> createInvite(Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        String token = UUID.randomUUID().toString();
        FriendInvite invite = new FriendInvite(token, userId);
        inviteRepository.save(invite);

        String inviteUrl = appBaseUrl + "/friends/accept?token=" + token;

        return ResponseEntity.ok(new InviteResponse(token, inviteUrl, invite.getExpiresAt()));
    }

    // ── DEV-156: POST /api/v1/friends/invite/{token}/accept ──────────────

    @PostMapping("/invite/{token}/accept")
    public ResponseEntity<Void> acceptInvite(
            @PathVariable String token, Authentication auth) {

        int acceptorId = (Integer) auth.getPrincipal();
        FriendInvite invite = inviteRepository.findByToken(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found"));

        if (invite.isAccepted()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invite already accepted");
        }
        if (invite.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invite expired");
        }
        if (invite.getInviterId() == acceptorId) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Cannot accept your own invite");
        }

        // Idempotent: skip if already friends
        if (friendRepository.findFriendship(invite.getInviterId(), acceptorId).isEmpty()) {
            friendRepository.save(new Friend(invite.getInviterId(), acceptorId));
        }

        invite.accept(acceptorId);
        inviteRepository.save(invite);

        return ResponseEntity.noContent().build();
    }

    // ── DEV-157: GET /api/v1/friends ─────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<FriendResponse>> listFriends(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        List<Friend> friendships = friendRepository.findAllByUserId(userId);

        LocalDateTime startOfToday = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime endOfToday   = startOfToday.plusDays(1);

        List<FriendResponse> result = friendships.stream().map(f -> {
            int friendId = f.otherUserId(userId);
            User friend = userRepository.findById(friendId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

            List<com.cardgames.server.session.Session> todaySessions =
                sessionRepository.findByUserIdAndStartedAtBetween(friendId, startOfToday, endOfToday);
            int wonToday = (int) todaySessions.stream()
                .filter(s -> com.cardgames.server.session.Session.STATUS_WON.equals(s.getStatus()))
                .count();

            return new FriendResponse(friendId, friend.getDisplayName(), friend.getlasthand(), wonToday);
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── DEV-158: DELETE /api/v1/friends/{userId} ─────────────────────────

    @DeleteMapping("/{targetUserId}")
    public ResponseEntity<Void> removeFriend(
            @PathVariable int targetUserId, Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        Friend friendship = friendRepository.findFriendship(userId, targetUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friendship not found"));

        friendRepository.delete(friendship);
        return ResponseEntity.noContent().build();
    }
}
