import Foundation
import Observation

// MARK: - FriendsStore (Sprint iOS-8 — DEV-293..302, DEV-334)

/// Manages all state for the Social tab: friends, friend requests, invites,
/// Game Center import, the friend league, custom leagues, and social challenges.
///
/// One instance lives in ContentView and is injected via the environment.
@MainActor
@Observable
final class FriendsStore {

    // MARK: - Auth context (set by ContentView)

    var userId: Int = UserDefaults.standard.integer(forKey: "klondike_user_id")

    // MARK: - Friends (DEV-294)

    private(set) var friends: [Friend] = []
    private(set) var isLoadingFriends = false

    // MARK: - Friend requests (DEV-295)

    private(set) var receivedRequests: [FriendRequestEntry] = []

    // MARK: - Connect requests (accepted acknowledgments)

    /// Connect requests the user SENT that were accepted but not yet seen.
    private(set) var acceptedRequests: [AcceptedRequestEntry] = []
    /// Portion of the badge from accepted-unseen — zeroed the moment Social is viewed.
    private(set) var acceptedUnseenCount = 0
    /// UUIDs the user has sent a connect request to this session (drives leaderboard button state).
    private var sentConnectUuids: Set<UUID> = []

    /// Badge count for the Social tab — incoming requests + accepted acknowledgments + active challenges.
    var socialBadgeCount: Int { receivedRequests.count + acceptedUnseenCount + pendingChallengeCount }

    // MARK: - Game Center import (DEV-334)

    private(set) var gcImportResult: [GameCenterMatchEntry] = []
    var isImportingGameCenter = false
    var gcImportMessage: String?

    // MARK: - League (DEV-296)

    var leaguePeriod: String = "weekly"        // weekly | monthly | alltime
    private(set) var leagueEntries: [LeagueEntry] = []
    private(set) var isLoadingLeague = false

    // MARK: - Custom leagues (DEV-297)

    private(set) var customLeagues: [CustomLeagueListEntry] = []
    private(set) var isLoadingCustomLeagues = false

    // MARK: - Social challenges (DEV-298, DEV-302)

    private(set) var challenges: [SocialChallenge] = []
    private(set) var isLoadingChallenges = false
    private(set) var pendingChallengeCount = 0

    // MARK: - Shared

    var errorMessage: String?

    // MARK: - Friends list

    func fetchFriends() async {
        guard !isLoadingFriends else { return }
        isLoadingFriends = true
        defer { isLoadingFriends = false }
        do {
            let page: PagedResponse<Friend> = try await APIClient.shared.get("/api/v1/friends")
            friends = page.items
        } catch {
            friends = []
        }
    }

    func removeFriend(_ friend: Friend) async {
        // Optimistic removal
        friends.removeAll { $0.userId == friend.userId }
        do {
            try await APIClient.shared.deleteVoid("/api/v1/friends/\(friend.userId)")
        } catch {
            // Re-fetch on failure to restore truth
            await fetchFriends()
        }
    }

    func createInvite() async -> FriendInviteResponse? {
        do {
            return try await APIClient.shared.postEmpty("/api/v1/friends/invite")
        } catch {
            errorMessage = "Could not create an invite link."
            return nil
        }
    }

    // MARK: - Friend requests (DEV-295)

    func fetchReceivedRequests() async {
        do {
            receivedRequests = try await APIClient.shared.get("/api/v1/friends/requests/received")
        } catch {
            receivedRequests = []
        }
    }

    func acceptRequest(_ request: FriendRequestEntry) async {
        receivedRequests.removeAll { $0.id == request.id }
        do {
            try await APIClient.shared.postVoid("/api/v1/friends/requests/\(request.id)/accept")
            await fetchFriends()
        } catch {
            await fetchReceivedRequests()
        }
    }

    func declineRequest(_ request: FriendRequestEntry) async {
        receivedRequests.removeAll { $0.id == request.id }
        do {
            try await APIClient.shared.deleteVoid("/api/v1/friends/requests/\(request.id)")
        } catch {
            await fetchReceivedRequests()
        }
    }

    func sendFriendRequest(targetUserId: Int) async {
        do {
            try await APIClient.shared.postBodyVoid(
                "/api/v1/friends/requests",
                body: FriendRequestBody(targetUserId: targetUserId)
            )
        } catch {
            errorMessage = "Could not send the friend request."
        }
    }

    // MARK: - Connect requests

    /// Whether the user has already sent a connect request to this player this session.
    func hasSentConnect(to uuid: UUID) -> Bool { sentConnectUuids.contains(uuid) }

    /// Send a connect request to a player identified by their public UUID (from a leaderboard).
    @discardableResult
    func sendConnectRequest(toUserUuid uuid: UUID) async -> Bool {
        sentConnectUuids.insert(uuid)   // optimistic — button flips to "Requested"
        do {
            try await APIClient.shared.postBodyVoid(
                "/api/v1/friends/requests/by-uuid",
                body: ConnectRequestBody(targetUserUuid: uuid.uuidString)
            )
            return true
        } catch {
            sentConnectUuids.remove(uuid)
            errorMessage = "Could not send the connect request."
            return false
        }
    }

    /// Fetch connect requests the user sent that were accepted but not yet seen.
    func fetchAcceptedRequests() async {
        do {
            acceptedRequests = try await APIClient.shared.get("/api/v1/friends/requests/accepted")
            acceptedUnseenCount = acceptedRequests.count
        } catch {
            acceptedRequests = []
            acceptedUnseenCount = 0
        }
    }

    /// Mark accepted acknowledgments as seen — drops the badge immediately and clears server-side.
    func markAcceptedSeen() async {
        guard acceptedUnseenCount > 0 else { return }
        acceptedUnseenCount = 0
        do {
            try await APIClient.shared.postVoid("/api/v1/friends/requests/accepted/seen")
        } catch { /* best-effort; badge already cleared locally */ }
    }

    func dismissAccepted(_ entry: AcceptedRequestEntry) {
        acceptedRequests.removeAll { $0.id == entry.id }
    }

    /// Report the device region so other players see it in their Connect Requests list.
    func updateLocation() async {
        guard let code = Locale.current.region?.identifier else { return }
        let name = Locale.current.localizedString(forRegionCode: code) ?? code
        do {
            try await APIClient.shared.putBodyVoid(
                "/api/v1/profile/location",
                body: LocationBody(location: name)
            )
        } catch { /* non-critical */ }
    }

    // MARK: - Game Center import (DEV-334)

    func importGameCenterFriends(playerIds: [String]) async {
        guard !playerIds.isEmpty else {
            gcImportMessage = "No Game Center friends to import."
            return
        }
        isImportingGameCenter = true
        gcImportMessage = nil
        defer { isImportingGameCenter = false }
        do {
            let matches: [GameCenterMatchEntry] = try await APIClient.shared.post(
                "/api/v1/friends/game-center/import",
                body: GameCenterImportRequest(playerIds: playerIds)
            )
            gcImportResult = matches
            let added = matches.filter { $0.addedAsRequest }.count
            let already = matches.filter { $0.alreadyFriend }.count
            if matches.isEmpty {
                gcImportMessage = "None of your Game Center friends play Klondike Pro yet."
            } else {
                gcImportMessage = "Found \(matches.count) — \(added) request\(added == 1 ? "" : "s") sent, \(already) already friends."
            }
            await fetchReceivedRequests()
        } catch {
            gcImportMessage = "Game Center import failed. Please try again."
        }
    }

    // MARK: - League (DEV-296)

    func fetchLeague() async {
        guard !isLoadingLeague else { return }
        isLoadingLeague = true
        defer { isLoadingLeague = false }
        do {
            let page: PagedResponse<LeagueEntry> = try await APIClient.shared.get(
                "/api/v1/leagues",
                query: ["period": leaguePeriod]
            )
            leagueEntries = page.items
        } catch {
            leagueEntries = []
        }
    }

    // MARK: - Custom leagues (DEV-297)

    func fetchCustomLeagues() async {
        guard !isLoadingCustomLeagues else { return }
        isLoadingCustomLeagues = true
        defer { isLoadingCustomLeagues = false }
        do {
            customLeagues = try await APIClient.shared.get("/api/v1/custom-leagues")
        } catch {
            customLeagues = []
        }
    }

    func createCustomLeague(name: String, memberIds: [Int]) async {
        do {
            let _: CustomLeagueListEntry = try await APIClient.shared.post(
                "/api/v1/custom-leagues",
                body: CreateLeagueRequest(name: name, memberIds: memberIds)
            )
            await fetchCustomLeagues()
        } catch {
            errorMessage = "Could not create the league."
        }
    }

    func leagueDetail(id: Int) async -> CustomLeagueDetail? {
        try? await APIClient.shared.get("/api/v1/custom-leagues/\(id)")
    }

    func leagueLeaderboard(id: Int, period: String) async -> [LeagueEntry] {
        (try? await APIClient.shared.get(
            "/api/v1/custom-leagues/\(id)/leaderboard",
            query: ["period": period]
        )) ?? []
    }

    func deleteCustomLeague(id: Int) async {
        customLeagues.removeAll { $0.id == id }
        do {
            try await APIClient.shared.deleteVoid("/api/v1/custom-leagues/\(id)")
        } catch {
            await fetchCustomLeagues()
        }
    }

    func removeLeagueMember(leagueId: Int, userId: Int) async {
        do {
            try await APIClient.shared.deleteVoid("/api/v1/custom-leagues/\(leagueId)/members/\(userId)")
        } catch {
            errorMessage = "Could not remove the member."
        }
    }

    // MARK: - Social challenges (DEV-298, DEV-300, DEV-302)

    func fetchChallenges() async {
        guard !isLoadingChallenges else { return }
        isLoadingChallenges = true
        defer { isLoadingChallenges = false }
        do {
            challenges = try await APIClient.shared.get("/api/v1/social/challenges")
        } catch {
            challenges = []
        }
        await fetchPendingChallengeCount()
    }

    func fetchPendingChallengeCount() async {
        struct CountResponse: Decodable { let count: Int }
        if let resp: CountResponse = try? await APIClient.shared.get("/api/v1/social/challenges/pending-count") {
            pendingChallengeCount = resp.count
        }
    }

    func challengeDetail(id: Int) async -> SocialChallengeDetail? {
        try? await APIClient.shared.get("/api/v1/social/challenges/\(id)")
    }

    func endChallenge(id: Int) async {
        do {
            try await APIClient.shared.postVoid("/api/v1/social/challenges/\(id)/end")
            await fetchChallenges()
        } catch {
            errorMessage = "Could not end the challenge."
        }
    }

    func resumeChallenge(id: Int) async {
        do {
            try await APIClient.shared.postVoid("/api/v1/social/challenges/\(id)/resume")
            await fetchChallenges()
        } catch {
            errorMessage = "Could not resume the challenge."
        }
    }

    // MARK: - Create challenge from a won hand (DEV-344, web UX parity)

    /// Creates a social challenge from a won session, inviting the explicitly
    /// chosen friends and/or league members — mirroring the web flow (pick a hand,
    /// then pick friends and/or leagues, then send). Both arrays are sent even when
    /// empty so the backend uses the explicit-selection path (never the "all
    /// friends" fallback). Returns true on success.
    func createChallenge(fromSessionUuid sessionUuid: UUID,
                         invitedUserIds: [Int],
                         invitedLeagueIds: [Int]) async -> Bool {
        struct Body: Encodable {
            let sessionUuid: UUID
            let invitedUserIds: [Int]
            let invitedLeagueIds: [Int]
        }
        do {
            try await APIClient.shared.postBodyVoid(
                "/api/v1/social/challenges",
                body: Body(sessionUuid: sessionUuid,
                           invitedUserIds: invitedUserIds,
                           invitedLeagueIds: invitedLeagueIds)
            )
            await fetchChallenges()
            return true
        } catch {
            errorMessage = "Could not create the challenge."
            return false
        }
    }

    /// Creator-only: add friends to an active challenge ("add players").
    func addParticipants(challengeId: Int, userIds: [Int]) async -> Bool {
        struct Body: Encodable { let userIds: [Int] }
        guard !userIds.isEmpty else { return false }
        do {
            try await APIClient.shared.postBodyVoid(
                "/api/v1/social/challenges/\(challengeId)/participants",
                body: Body(userIds: userIds))
            return true
        } catch {
            errorMessage = "Could not add players."
            return false
        }
    }

    // MARK: - Delete / hide a challenge (DEV-346, web UX parity)

    /// Creator-only: permanently delete a challenge you created. The backend
    /// cascade-removes all participant records. Mirrors the web "delete challenge"
    /// action. Optimistically removes it from the local list on success.
    func deleteChallenge(id: Int) async {
        do {
            try await APIClient.shared.deleteVoid("/api/v1/social/challenges/\(id)")
            challenges.removeAll { $0.id == id }
        } catch {
            errorMessage = "Could not delete the challenge."
        }
    }

    /// Participant-only: hide a challenge you were invited to from your own list.
    /// It stays visible to the creator and other participants. The web shows this
    /// as "remove" for challenges you didn't create (the backend `/hide` endpoint
    /// rejects the creator with "use delete to remove your own challenge").
    func hideChallenge(id: Int) async {
        do {
            try await APIClient.shared.postVoid("/api/v1/social/challenges/\(id)/hide")
            challenges.removeAll { $0.id == id }
        } catch {
            errorMessage = "Could not remove the challenge."
        }
    }

    /// Clears the challenge badge once the user has viewed the Challenges tab (DEV-302).
    func markChallengesViewed() {
        pendingChallengeCount = 0
    }
}
