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

        // Step 1 — show native GK auth sheet and wait for result
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            GKLocalPlayer.local.authenticateHandler = { _, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if GKLocalPlayer.local.isAuthenticated {
                    continuation.resume(returning: ())
                } else {
                    // Handler called with no error but player not authenticated
                    // — user cancelled the sheet.
                    continuation.resume(throwing: GameCenterError.cancelled)
                }
            }
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

    // MARK: - Friend import (DEV-334)

    /// Loads the local player's Game Center friends (those who have consented to
    /// friend sharing) and returns their teamPlayerIDs — the same identifier stored
    /// server-side at login, so the backend can match them to linked accounts.
    ///
    /// - Throws: a GameKit error if the player is not authenticated or has not
    ///   granted friend-list access.
    func loadFriendTeamPlayerIDs() async throws -> [String] {
        guard GKLocalPlayer.local.isAuthenticated else {
            throw GameCenterError.notAuthenticated
        }
        let friends = try await GKLocalPlayer.local.loadFriends()
        return friends.map { $0.teamPlayerID }
    }
}
