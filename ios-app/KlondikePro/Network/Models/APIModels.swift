import Foundation

// MARK: - Auth

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RegisterRequest: Encodable {
    let email: String
    let password: String
    let displayName: String
}

struct AuthResponse: Decodable {
    let accessToken: String
    let user: UserDto

    struct UserDto: Decodable {
        let id: Int
        let uuid: UUID
        let email: String
        let displayName: String
    }
}

struct RefreshResponse: Decodable {
    let accessToken: String
}

// MARK: - Profile

struct ProfileResponse: Decodable, Identifiable {
    let userId: Int?        // integer PK — used to recover userId if UserDefaults/Keychain is empty
    let uuid: UUID
    let displayName: String
    let email: String
    let theme: String?
    let avatarUrl: String?
    let createdAt: Date?
    let lastHand: Date?
    /// Auth providers linked to this account, e.g. ["email", "game_center"] (DEV-332)
    let linkedProviders: [String]?

    // Conform to Identifiable using UUID
    var id: UUID { uuid }

    enum CodingKeys: String, CodingKey {
        case userId = "id"
        case uuid, displayName, email, theme, avatarUrl, createdAt, lastHand, linkedProviders
    }
}

struct PatchProfileRequest: Encodable {
    var displayName: String?
    var theme: String?
}

// MARK: - Preferences

struct Preferences: Codable {
    var drawModeDefault: String
    var cardFaceDesign: String
    var cardBackColour: String
    var cardBackPattern: String?
    var feltColour: String
    var animationsEnabled: Bool
    var animationSpeed: String
    var winAnimation: String
    var stockSide: String
    var cardStyle: String
    /// DEV-337: canonical felt theme name (dark-premium / classic-felt / modern-minimal), or "custom".
    var themeName: String?
    /// DEV-314: daily reminder local time as "HH:mm:ss" (server LocalTime), nil = disabled.
    var dailyReminderTime: String?

    static let defaults = Preferences(
        drawModeDefault: "draw3",
        cardFaceDesign: "standard",
        cardBackColour: "#1c2333",
        cardBackPattern: nil,
        feltColour: "#0d1117",
        animationsEnabled: true,
        animationSpeed: "normal",
        winAnimation: "confetti",
        stockSide: "left",
        cardStyle: "classic",
        themeName: "dark-premium",
        dailyReminderTime: nil
    )
}

// MARK: - Hands

struct Hand: Decodable, Identifiable {
    let id: Int
    let uuid: UUID
    let shuffleSeed: Int64
    let cards: [Int]
    let drawMode: String
}

struct CreateHandRequest: Encodable {
    let drawMode: String
    let seed: Int64?

    init(drawMode: String, seed: Int64? = nil) {
        self.drawMode = drawMode
        self.seed = seed
    }
}

// MARK: - Sessions

/// Minimal session representation returned by the server.
/// The backend @JsonIgnore's id/handId/userId and LocalDateTime fields
/// serialise without a timezone, so we only decode what's reliably present.
/// Matches the web frontend's SessionSummary shape.
struct Session: Decodable, Identifiable {
    let uuid: UUID
    let status: String   // active | won | abandoned
    let moves: Int
    let timeSeconds: Int
    let isRanked: Bool?  // optional — guards against is* naming variants across Jackson versions

    var id: UUID { uuid }
}

struct CreateSessionRequest: Encodable {
    let handUuid: UUID
    let userId: Int
    let isDaily: Bool
    let dailyDate: String?
    let isRanked: Bool?
}

struct CreateSessionResponse: Decodable {
    let session: Session
    let isRanked: Bool
}

struct CompleteSessionRequest: Encodable {
    let moves: Int
    let timeSeconds: Int
    let turns: String
}

struct CompleteSessionResponse: Decodable {
    let valid: Bool
    let message: String
    let moveCount: Int
    let session: Session?
}

struct AbandonSessionRequest: Encodable {
    let moves: Int
    let timeSeconds: Int
    let turns: String
}

// MARK: - Active sessions (DEV-252)

/// Wrapper returned by GET /api/v1/sessions/active.
/// Both fields are optional — null means no in-progress session of that type.
struct ActiveSessionsResponse: Decodable {
    let daily:  ActiveSessionItem?
    let random: ActiveSessionItem?
}

/// A single in-progress session with enough data for the iOS client to
/// reconstruct game state locally: seed → SeededShuffle → replay turns.
struct ActiveSessionItem: Decodable {
    let uuid:        UUID
    let handUuid:    UUID
    let drawMode:    String
    let seed:        Int64
    let turns:       String
    let moves:       Int
    let timeSeconds: Int    // DEV-338: saved elapsed, so the clock resumes correctly
    let startedAt:   Date
    let isDaily:     Bool
}

// MARK: - Daily

/// The hand payload inside a DailyHandResponse.
/// Matches the server's HandResponse record — no `id` field.
struct DailyHand: Decodable {
    let uuid: UUID
    let shuffleSeed: Int64
    let cards: [Int]
    let drawMode: String
}

/// Top-level response from GET /api/v1/daily and GET /api/v1/daily/{date}.
/// The `date` field is the authoritative challenge date from the backend —
/// use this, not the device clock, to tag sessions and display the header.
struct DailyResponse: Decodable {
    let hand: DailyHand
    let userHasRankedAttempt: Bool
    let date: String   // "yyyy-MM-dd" — canonical challenge date
}

struct DailyCalendarEntry: Decodable, Identifiable {
    let date: String
    let handUuid: UUID?    // nil when no challenge exists for this day
    let drawMode: String
    let userStatus: String // won | played | not_played

    var id: String { date }
}

// MARK: - Leaderboard

/// One row in the daily leaderboard.
/// `sessionUuid` is present when the entry can be replayed.
struct DailyLeaderboardEntry: Decodable, Identifiable {
    let rank: Int
    let userUuid: UUID?
    let displayName: String
    let moves: Int
    let timeSeconds: Int
    let sessionUuid: UUID?

    var id: String { userUuid?.uuidString ?? displayName }
}

struct GlobalLeaderboardEntry: Decodable, Identifiable {
    let rank: Int
    let userUuid: UUID?
    let displayName: String
    let moves: Int
    let timeSeconds: Int

    var id: UUID { userUuid ?? UUID() }
}

struct PagedResponse<T: Decodable>: Decodable {
    let items: [T]
    let nextCursor: String?
    let hasMore: Bool
}

// MARK: - Friends (DEV-294)
// Matches backend FriendResponse (friends use integer userId, not UUID).

struct Friend: Decodable, Identifiable {
    let userId: Int
    let displayName: String
    let lastActive: Date?
    let gamesCompletedToday: Int
    let avatarUrl: String?

    var id: Int { userId }
}

/// Matches backend InviteResponse (POST /friends/invite).
struct FriendInviteResponse: Decodable {
    let token: String
    let inviteUrl: String
    let expiresAt: Date?
}

/// Matches backend FriendRequestEntry (GET /friends/requests/received).
struct FriendRequestEntry: Decodable, Identifiable {
    let id: Int
    let requesterId: Int
    let requesterDisplayName: String
    let createdAt: Date?
}

/// Matches backend InvitePreviewResponse (GET /friends/invites/preview/{token}).
struct InvitePreviewResponse: Decodable {
    let token: String
    let inviterDisplayName: String
}

/// DEV-295: body for POST /friends/requests.
struct FriendRequestBody: Encodable {
    let targetUserId: Int
}

// MARK: - Game Center friend import (DEV-334)

struct GameCenterImportRequest: Encodable {
    let playerIds: [String]
}

struct GameCenterMatchEntry: Decodable, Identifiable {
    let userId: Int
    let displayName: String
    let avatarUrl: String?
    let alreadyFriend: Bool
    let addedAsRequest: Bool

    var id: Int { userId }
}

// MARK: - Leagues (DEV-296)
// Matches backend LeagueEntry (friend league table).

struct LeagueEntry: Decodable, Identifiable {
    let rank: Int
    let userId: Int
    let displayName: String
    let wins: Int
    let bestMoves: Int?

    var id: Int { userId }
}

// MARK: - Custom Leagues (DEV-297)

struct CustomLeagueListEntry: Decodable, Identifiable {
    let id: Int
    let name: String
    let creatorUserId: Int
    let creatorDisplayName: String
    let memberCount: Int
    let isCreator: Bool
    let createdAt: Date?
}

struct CustomLeagueMemberEntry: Decodable, Identifiable {
    let userId: Int
    let displayName: String
    let isFriend: Bool
    let hasPendingRequest: Bool

    var id: Int { userId }
}

struct CustomLeagueDetail: Decodable {
    let id: Int
    let name: String
    let creatorUserId: Int
    let createdAt: Date?
    let isCreator: Bool
    let members: [CustomLeagueMemberEntry]
}

struct CreateLeagueRequest: Encodable {
    let name: String
    let memberIds: [Int]
}

// MARK: - Social Challenges (DEV-298)
// Matches backend SocialChallengeListEntry / SocialChallengeDetail (UUID-based).

struct SocialChallenge: Decodable, Identifiable {
    let id: Int
    let creatorUserUuid: UUID?
    let creatorDisplayName: String
    let handUuid: UUID?
    let drawMode: String
    let status: String   // active | ended
    let createdAt: Date?
    let endedAt: Date?
    let participantCount: Int
    let winnerCount: Int
    let userHasWon: Bool
    let isCreator: Bool
}

struct SocialLeaderboardEntry: Decodable, Identifiable {
    let rank: Int
    let userId: Int
    let displayName: String
    let isCreator: Bool
    let moves: Int?
    let timeSeconds: Int?

    var id: Int { userId }
}

struct SocialChallengeDetail: Decodable {
    let id: Int
    let creatorUserUuid: UUID?
    let creatorDisplayName: String
    let handUuid: UUID?
    let drawMode: String
    let status: String
    let createdAt: Date?
    let endedAt: Date?
    let leaderboard: [SocialLeaderboardEntry]
}

// MARK: - Profile Calendar + Day Sessions (DEV-281, DEV-282)

/// One day's activity summary — used by the profile calendar heatmap.
/// Returned by GET /api/v1/profile/calendar?weeks=N
struct ProfileCalendarEntry: Decodable, Identifiable {
    let date: String       // "yyyy-MM-dd"
    let gamesPlayed: Int
    let gamesWon: Int
    var id: String { date }
}

/// One session within a day — used by DayDetailSheet.
/// Returned by GET /api/v1/profile/sessions?date=yyyy-MM-dd
struct ProfileDaySession: Decodable, Identifiable {
    let uuid: UUID
    let drawMode: String
    let moves: Int
    let timeSeconds: Int
    let isWon: Bool
    let completedAt: Date?
    var id: UUID { uuid }
}

// MARK: - Avatar Upload (DEV-284)

/// Step 1: POST /api/v1/profile/avatar { contentType }
/// → backend returns { uploadUrl, publicUrl }
struct AvatarUploadRequest: Encodable {
    let contentType: String
}

/// Response from POST /api/v1/profile/avatar — matches AvatarUploadResponse.java
struct AvatarUploadResponse: Decodable {
    let uploadUrl: String   // presigned S3 PUT URL (15-min expiry)
    let publicUrl: String   // CDN URL to save after a successful PUT
}

/// Step 3: PATCH /api/v1/profile/avatar { avatarUrl } — matches AvatarConfirmRequest.java
struct AvatarConfirmRequest: Encodable {
    let avatarUrl: String
}

// MARK: - Preferences PATCH (DEV-286)

/// Partial-update request for PATCH /api/v1/profile/preferences.
/// Nil fields are encoded as JSON null — the backend treats null as "leave unchanged".
struct PatchPreferencesRequest: Encodable {
    var drawModeDefault:  String?
    var cardFaceDesign:   String?
    var cardStyle:        String?
    var cardBackColour:   String?
    var cardBackPattern:  String?
    var feltColour:       String?
    var animationsEnabled: Bool?
    var stockSide:        String?
    var animationSpeed:   String?
    var winAnimation:     String?
    var themeName:        String?   // DEV-337
    // DEV-314: "HH:mm" to enable, "" to disable; offset is minutes east of UTC.
    var dailyReminderTime:     String?
    var dailyReminderTzOffset: Int?
}

// MARK: - Account Management (DEV-285)

struct ChangePasswordRequest: Encodable {
    let currentPassword: String
    let newPassword: String
}

/// DELETE /api/v1/profile requires password confirmation — matches DeleteAccountRequest.java
struct DeleteAccountRequest: Encodable {
    let password: String
}

// MARK: - Stats & Records

/// Backend returns { draw1: {...}, draw3: {...} } — an object with two named keys,
/// NOT an array. This shape matches StatsResponse.java exactly.
struct StatsResponse: Decodable {
    struct DrawModeStats: Decodable {
        let gamesPlayed: Int
        let wins: Int
        let winRate: Double
        let avgMoves: Double
        let avgTimeSeconds: Double
    }
    let draw1: DrawModeStats
    let draw3: DrawModeStats

    /// Convenience: flat list with the draw-mode label injected for display.
    struct LabelledStats {
        let drawMode: String
        let gamesPlayed: Int
        let wins: Int
        let winRate: Double
        let avgMoves: Double
        let avgTimeSeconds: Double
    }

    var byDrawMode: [LabelledStats] {
        [
            LabelledStats(drawMode: "draw1", gamesPlayed: draw1.gamesPlayed,
                         wins: draw1.wins, winRate: draw1.winRate,
                         avgMoves: draw1.avgMoves, avgTimeSeconds: draw1.avgTimeSeconds),
            LabelledStats(drawMode: "draw3", gamesPlayed: draw3.gamesPlayed,
                         wins: draw3.wins, winRate: draw3.winRate,
                         avgMoves: draw3.avgMoves, avgTimeSeconds: draw3.avgTimeSeconds),
        ].filter { $0.gamesPlayed > 0 }
    }
}

/// Backend PersonalBest uses sessionUuid/handUuid (UUIDs), not Int IDs.
/// completedAt is a LocalDateTime serialised as "yyyy-MM-ddTHH:mm:ss" — no timezone.
struct RecordsResponse: Decodable {
    struct PersonalBest: Decodable {
        let sessionUuid: UUID
        let handUuid: UUID
        let drawMode: String
        let moves: Int
        let timeSeconds: Int
        let completedAt: Date?   // decoded via iso8601 strategy in APIClient
    }
    let fewestMoves: PersonalBest?
    let fastestTime: PersonalBest?
}

// MARK: - Replay

struct ReplayMove: Decodable {
    let type: String
    let col: Int?
    let fromCol: Int?
    let fromIdx: Int?
    let toCol: Int?
    let foundationIdx: Int?
}

struct ReplayResponse: Decodable {
    let sessionUuid: UUID
    let handUuid: UUID
    let drawMode: String
    let moveCount: Int
    let moves: [ReplayMove]
    let cards: [Int]
}

// MARK: - Game Center Auth

struct GameCenterAuthRequest: Encodable {
    let playerId:    String
    let bundleId:    String
    let publicKeyUrl: String
    let signature:   String   // base64
    let salt:        String   // base64
    let timestamp:   UInt64
    let displayName: String?  // GKLocalPlayer.displayName — used when creating a new account
}

// MARK: - Push Notifications (DEV-309)

/// Body for POST /api/v1/profile/device-token.
/// `deviceId` is UIDevice.identifierForVendor; `platform` is always "ios" here.
struct RegisterDeviceTokenRequest: Encodable {
    let token: String
    let deviceId: String
    let platform: String
}
