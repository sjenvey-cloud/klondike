import GameKit
import Foundation

// MARK: - Errors

enum GameCenterError: LocalizedError {
    case notAuthenticated
    case signatureFetchFailed
    case cancelled

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:    return "Game Center sign-in was cancelled or failed."
        case .signatureFetchFailed: return "Could not retrieve your Game Center identity."
        case .cancelled:           return "Game Center sign-in was cancelled."
        }
    }
}

// MARK: - Resume guard

/// Thread-safe latch ensuring a block runs at most once. GameKit's
/// `authenticateHandler` may be invoked repeatedly (and from arbitrary threads);
/// this prevents a double `CheckedContinuation.resume`, which would trap.
private final class ResumeOnce: @unchecked Sendable {
    private var done = false
    private let lock = NSLock()
    func run(_ body: () -> Void) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        body()
    }
}

// MARK: - Service

/// DEV-249: Handles Game Center authentication and identity-signature fetch.
///
/// Usage:
///   let request = try await GameCenterService.shared.authenticate()
///   // Then POST request to /api/v1/auth/game-center via AuthService
///
/// This actor is intentionally separate from AuthStore so that the GK lifecycle
/// (which manages its own UI sheet) can be tested in isolation.
actor GameCenterService {

    static let shared = GameCenterService()
    private init() {}

    /// Authenticates the local GK player and fetches an identity verification
    /// signature suitable for POSTing to POST /api/v1/auth/game-center.
    ///
    /// - Throws: `GameCenterError` or a GameKit `NSError` on failure.
    /// - Returns: A fully populated `GameCenterAuthRequest`.
    func authenticate() async throws -> GameCenterAuthRequest {

        // Step 1 — ensure the local player is authenticated.
        //
        // DEV-343 (link hang): only install the authenticateHandler when the player
        // is NOT already authenticated. GameKit invokes a freshly-assigned handler
        // only when the authentication STATE changes. If the player is already
        // signed in — the usual case when linking from Settings after a Game Center
        // login, or when the device is signed into Game Center at the OS level —
        // re-assigning the handler never fires it, so the continuation suspends
        // forever and the "Link" spinner hangs indefinitely. Skip straight to the
        // signature fetch when we're already authenticated.
        if !GKLocalPlayer.local.isAuthenticated {
            try await authenticateLocalPlayer()
        }

        // Step 2 — fetch ECDSA identity verification signature
        // Note: iOS 26 SDK dropped the legacy playerID parameter; the closure
        // now has 5 parameters: (URL?, Data?, Data?, UInt64, Error?)
        let player = GKLocalPlayer.local
        let (publicKeyURL, signature, salt, timestamp): (URL, Data, Data, UInt64) =
            try await withCheckedThrowingContinuation { continuation in
                // iOS 26 SDK renamed this method (previously fetchItemsForIdentityVerificationSignature)
                player.fetchItems(forIdentityVerificationSignature: { url, sig, salt, ts, error in
                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }
                    guard let url, let sig, let salt else {
                        continuation.resume(throwing: GameCenterError.signatureFetchFailed)
                        return
                    }
                    continuation.resume(returning: (url, sig, salt, ts))
                })
            }

        return GameCenterAuthRequest(
            playerId:     player.teamPlayerID,
            bundleId:     Bundle.main.bundleIdentifier ?? "com.klondikepro.app",
            publicKeyUrl: publicKeyURL.absoluteString,
            signature:    signature.base64EncodedString(),
            salt:         salt.base64EncodedString(),
            timestamp:    timestamp,
            displayName:  player.displayName
        )
    }

    /// Installs the GameKit authenticate handler and suspends until the local
    /// player is authenticated, cancels, or errors.
    ///
    /// Resumes its continuation exactly once: `authenticateHandler` can be invoked
    /// multiple times as the authentication state changes, and resuming a
    /// `CheckedContinuation` more than once traps. Only called when the player is
    /// not yet authenticated (see `authenticate()` step 1).
    private func authenticateLocalPlayer() async throws {
        let once = ResumeOnce()
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            GKLocalPlayer.local.authenticateHandler = { viewController, error in
                once.run {
                    if let error {
                        continuation.resume(throwing: error)
                    } else if GKLocalPlayer.local.isAuthenticated {
                        continuation.resume(returning: ())
                    } else if viewController != nil {
                        // GameKit wants to present its sign-in UI but there's no
                        // authenticated player and no presenter available here.
                        // Surface a clear error rather than hanging.
                        continuation.resume(throwing: GameCenterError.notAuthenticated)
                    } else {
                        // No error, no player, no UI — user dismissed the sheet.
                        continuation.resume(throwing: GameCenterError.cancelled)
                    }
                }
            }
        }
    }

    // MARK: - Friend import (DEV-334)

    /// Loads the local player's Game Center friends (those who have consented to
    /// friend sharing) and returns their teamPlayerIDs — the same identifier stored
    /// server-side at login, so the backend can match them to linked accounts.
    ///
    /// - Throws: a GameKit error if the player is not authenticated or has not
    ///   granted friend-list access.
    func loadFriendTeamPlayerIDs() async throws -> [String] {
        // The friend import may be the first Game Center touchpoint this session
        // (e.g. an email-login user who hasn't triggered GC auth yet), so make sure
        // the local player is authenticated before requesting the friend list.
        if !GKLocalPlayer.local.isAuthenticated {
            try await authenticateLocalPlayer()
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            throw GameCenterError.notAuthenticated
        }
        // Requires the NSGKFriendListUsageDescription Info.plist key; iOS prompts the
        // player for friend-list access on first call.
        let friends = try await GKLocalPlayer.local.loadFriends()
        return friends.map { $0.teamPlayerID }
    }

    // MARK: - Leaderboards (Daily Challenge)

    /// App Store Connect recurring daily-leaderboard IDs. Both are Integer scores
    /// sorted Low→High (fewer / faster ranks higher) and reset daily. They track
    /// the Daily Challenge only.
    enum Leaderboard {
        static let dailyFewestMoves = "com.klondikepro.leaderboard.draw3moves"
        static let dailyFastestTime = "com.klondikepro.leaderboard.draw3time"
    }

    /// Submits a Daily Challenge win to the two recurring daily leaderboards
    /// (fewest moves, fastest time). No-ops silently when Game Center isn't
    /// authenticated.
    func submitDailyResult(moves: Int, timeSeconds: Int) async {
        guard GKLocalPlayer.local.isAuthenticated else { return }
        if moves > 0 {
            try? await GKLeaderboard.submitScore(
                moves, context: 0, player: GKLocalPlayer.local,
                leaderboardIDs: [Leaderboard.dailyFewestMoves])
        }
        if timeSeconds > 0 {
            try? await GKLeaderboard.submitScore(
                timeSeconds, context: 0, player: GKLocalPlayer.local,
                leaderboardIDs: [Leaderboard.dailyFastestTime])
        }
    }
}
