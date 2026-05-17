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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/friends")
public class FriendController {

    @Value("${app.base-url}")
    private String appBaseUrl;

    private final FriendRepository        friendRepository;
    private final FriendInviteRepository  inviteRepository;
    private final FriendRequestRepository requestRepository;
    private final UserRepository          userRepository;
    private final SessionRepository       sessionRepository;

    public FriendController(FriendRepository friendRepository,
                            FriendInviteRepository inviteRepository,
                            FriendRequestRepository requestRepository,
                            UserRepository userRepository,
                            SessionRepository sessionRepository) {
        this.friendRepository  = friendRepository;
        this.inviteRepository  = inviteRepository;
        this.requestRepository = requestRepository;
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

            return new FriendResponse(friendId, friend.getDisplayName(), friend.getlasthand(), wonToday, friend.getAvatarUrl());
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

    // ── GET /api/v1/friends/invites — list my pending sent invites ────────

    @GetMapping("/invites")
    public ResponseEntity<List<SentInviteResponse>> listSentInvites(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();
        List<FriendInvite> invites = inviteRepository
            .findByInviterIdAndAcceptedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                userId, LocalDateTime.now());

        List<SentInviteResponse> result = invites.stream()
            .map(i -> new SentInviteResponse(
                i.getId(),
                i.getToken(),
                appBaseUrl + "/friends/accept?token=" + i.getToken(),
                i.getExpiresAt(),
                i.getCreatedAt()))
            .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── DELETE /api/v1/friends/invites/{id} — cancel a sent invite ────────

    @DeleteMapping("/invites/{id}")
    public ResponseEntity<Void> deleteInvite(
            @PathVariable int id, Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        FriendInvite invite = inviteRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found"));

        if (invite.getInviterId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your invite");
        }

        inviteRepository.delete(invite);
        return ResponseEntity.noContent().build();
    }

    // ── GET /api/v1/friends/invites/preview/{token} — preview without accepting

    @GetMapping("/invites/preview/{token}")
    public ResponseEntity<InvitePreviewResponse> previewInvite(
            @PathVariable String token, Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        FriendInvite invite = inviteRepository.findByToken(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found"));

        if (invite.isAccepted()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invite already accepted");
        }
        if (invite.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invite expired");
        }
        if (invite.getInviterId() == userId) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Cannot accept your own invite");
        }

        User inviter = userRepository.findById(invite.getInviterId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inviter not found"));

        return ResponseEntity.ok(new InvitePreviewResponse(token, inviter.getDisplayName()));
    }

    // ── POST /api/v1/friends/requests — send a direct friend request ───────
    // Used when adding a league member who isn't already a friend.
    // If the other user has already sent a request, auto-accepts into a friendship.

    @PostMapping("/requests")
    public ResponseEntity<Void> sendFriendRequest(
            @RequestBody Map<String, Integer> body, Authentication auth) {

        int userId   = (Integer) auth.getPrincipal();
        int targetId = body.get("targetUserId");

        if (userId == targetId) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Cannot add yourself");
        }
        if (friendRepository.findFriendship(userId, targetId).isPresent()) {
            return ResponseEntity.noContent().build(); // already friends — idempotent
        }

        // If the target already sent us a request, auto-accept both sides
        Optional<FriendRequest> reverse = requestRepository.findByRequesterIdAndRequesteeId(targetId, userId);
        if (reverse.isPresent()) {
            friendRepository.save(new Friend(userId, targetId));
            requestRepository.delete(reverse.get());
            requestRepository.findByRequesterIdAndRequesteeId(userId, targetId)
                .ifPresent(requestRepository::delete);
            return ResponseEntity.noContent().build();
        }

        // Idempotent: don't create a duplicate
        if (!requestRepository.existsByRequesterIdAndRequesteeId(userId, targetId)) {
            requestRepository.save(new FriendRequest(userId, targetId));
        }

        return ResponseEntity.noContent().build();
    }

    // ── GET /api/v1/friends/requests/received ─────────────────────────────

    @GetMapping("/requests/received")
    public ResponseEntity<List<FriendRequestEntry>> getReceivedRequests(Authentication auth) {
        int userId = (Integer) auth.getPrincipal();

        List<FriendRequestEntry> result = requestRepository.findByRequesteeId(userId).stream()
            .map(r -> {
                User requester = userRepository.findById(r.getRequesterId()).orElse(null);
                String name = requester != null ? requester.getDisplayName() : "Unknown";
                return new FriendRequestEntry(r.getId(), r.getRequesterId(), name, r.getCreatedAt());
            })
            .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── POST /api/v1/friends/requests/{id}/accept ─────────────────────────

    @PostMapping("/requests/{id}/accept")
    public ResponseEntity<Void> acceptFriendRequest(
            @PathVariable int id, Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        FriendRequest request = requestRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (request.getRequesteeId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your request");
        }

        if (friendRepository.findFriendship(request.getRequesterId(), userId).isEmpty()) {
            friendRepository.save(new Friend(request.getRequesterId(), userId));
        }
        requestRepository.delete(request);

        return ResponseEntity.noContent().build();
    }

    // ── DELETE /api/v1/friends/requests/{id} — decline or cancel ──────────

    @DeleteMapping("/requests/{id}")
    public ResponseEntity<Void> deleteFriendRequest(
            @PathVariable int id, Authentication auth) {

        int userId = (Integer) auth.getPrincipal();
        FriendRequest request = requestRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (request.getRequesteeId() != userId && request.getRequesterId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your request");
        }

        requestRepository.delete(request);
        return ResponseEntity.noContent().build();
    }
}
