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
    let uuid: UUID
    let displayName: String
    let email: String
    let theme: String?
    let avatarUrl: String?
    let createdAt: Date?
    let lastHand: Date?

    // Conform to Identifiable using UUID
    var id: UUID { uuid }
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
        cardStyle: "classic"
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
    let uuid:      UUID
    let handUuid:  UUID
    let drawMode:  String
    let seed:      Int64
    let turns:     String
    let moves:     Int
    let startedAt: Date
    let isDaily:   Bool
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

// MARK: - Friends

struct Friend: Decodable, Identifiable {
    let userUuid: UUID?
    let displayName: String
    let lastActive: Date?
    let gamesCompletedToday: Int

    var id: String { userUuid?.uuidString ?? displayName }
}

struct FriendInviteResponse: Decodable {
    let token: String
    let inviteUrl: String
    let expiresAt: Date?
}

// MARK: - Social Challenges

struct SocialChallenge: Decodable, Identifiable {
    let id: Int
    let creatorUserId: Int
    let creatorDisplayName: String
    let handId: Int
    let drawMode: String
    let status: String   // active | ended
    let createdAt: Date?
    let endedAt: Date?
    let participantCount: Int
    let winnerCount: Int
    let userHasWon: Bool
    let isCreator: Bool
}

struct SocialLeaderboardEntry: Decodable {
    let rank: Int
    let userId: Int
    let displayName: String
    let isCreator: Bool
    let moves: Int?
    let timeSeconds: Int?
}

struct SocialChallengeDetail: Decodable {
    let id: Int
    let creatorUserId: Int
    let creatorDisplayName: String
    let handId: Int
    let drawMode: String
    let status: String
    let createdAt: Date?
    let endedAt: Date?
    let leaderboard: [SocialLeaderboardEntry]
}

// MARK: - Stats & Records

struct StatsResponse: Decodable {
    struct DrawModeStats: Decodable {
        let drawMode: String
        let gamesPlayed: Int
        let wins: Int
        let winRate: Double
        let avgMoves: Double
        let avgTimeSeconds: Double
    }
    let byDrawMode: [DrawModeStats]
}

struct RecordsResponse: Decodable {
    struct SessionRecord: Decodable {
        let sessionId: Int
        let handId: Int
        let drawMode: String
        let moves: Int
        let timeSeconds: Int
        let completedAt: Date?
    }
    let fewestMoves: SessionRecord?
    let fastestTime: SessionRecord?
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
