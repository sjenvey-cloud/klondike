import Foundation
import Observation

// MARK: - Supporting types

struct DailyWinResult: Identifiable {
    let id = UUID()
    let moves: Int
    let timeSeconds: Int
    let rank: Int?
    let sessionUuid: UUID?
    let isRanked: Bool
    let date: String
    let drawMode: String
}

enum LeaderboardSort: String, CaseIterable {
    case moves = "moves"
    case time  = "time"

    var label: String {
        switch self {
        case .moves: return "Moves"
        case .time:  return "Time"
        }
    }
}

// MARK: - DailyStore (DEV-272, DEV-273, DEV-274, DEV-275, DEV-276, DEV-277, DEV-278)

/// Manages all state for the Daily Challenge tab:
/// today's hand, active game session, leaderboard, calendar, and win result.
///
/// One instance lives in ContentView and is injected via the environment.
@MainActor
@Observable
final class DailyStore {

    // MARK: - Auth context (set by ContentView after login)

    /// Seeded from UserDefaults so it's valid even before ContentView.onAppear fires.
    var userId: Int = UserDefaults.standard.integer(forKey: "klondike_user_id")

    // MARK: - Draw mode (DEV-278) — persisted across launches

    var drawMode: String = UserDefaults.standard.string(forKey: "daily_draw_mode") ?? "draw3"

    func selectDrawMode(_ mode: String) {
        drawMode = mode
        UserDefaults.standard.set(mode, forKey: "daily_draw_mode")
        // Reset fetched hand so the new mode is loaded on next appear
        dailyHand = nil
        dailyDate = ""
        handError = nil
    }

    // MARK: - Today's hand state

    private(set) var dailyHand: DailyHand?      = nil
    private(set) var dailyDate: String           = ""
    private(set) var userHasRankedAttempt: Bool  = false
    var isLoadingHand: Bool                      = false
    var handError: String?                       = nil

    // MARK: - Active game

    /// The GameStore driving the in-progress daily game.
    /// Replaced each time a new daily session is started.
    private(set) var gameStore: GameStore? = nil

    // MARK: - Win result

    /// Set after completeSession + rank fetch succeeds. Drives DailyWinView presentation.
    var winResult: DailyWinResult? = nil

    // MARK: - Leaderboard

    var leaderboard: [DailyLeaderboardEntry] = []
    var myRank: DailyLeaderboardEntry?        = nil
    var leaderboardSort: LeaderboardSort      = .moves
    var isLoadingLeaderboard: Bool            = false

    // MARK: - Calendar

    var calendarEntries: [DailyCalendarEntry] = []
    var isLoadingCalendar: Bool               = false

    // MARK: - Prior daily (calendar replay, DEV-277)

    /// Non-nil when the user has tapped a past calendar day and is playing it.
    private(set) var priorDate: String? = nil

    // MARK: - Cross-device daily resume (DEV-339)

    /// An in-progress daily session found on the server (possibly paused on
    /// another device). Surfaced as a Resume/Restart banner in the lobby.
    private(set) var activeDailySession: ActiveSessionItem? = nil

    /// The date whose leaderboard should be shown — the hand currently in context:
    /// a past daily being played, otherwise today's challenge.
    var activeDate: String {
        if let prior = priorDate, !prior.isEmpty { return prior }
        return dailyDate.isEmpty ? Self.todayString() : dailyDate
    }

    private static func todayString() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }

    // MARK: - Fetch today's hand

    func fetchToday() async {
        guard !isLoadingHand else { return }
        isLoadingHand = true
        handError     = nil
        defer { isLoadingHand = false }

        do {
            let response: DailyResponse = try await APIClient.shared.get(
                "/api/v1/daily",
                query: ["drawMode": drawMode]
            )
            dailyHand             = response.hand
            dailyDate             = response.date
            userHasRankedAttempt  = response.userHasRankedAttempt
        } catch {
            handError = "Could not load today's challenge. Check your connection and try again."
        }
    }

    // MARK: - Start today's daily game

    func startGame() async {
        guard let hand = dailyHand else { return }
        guard userId > 0 else {
            handError = "Not signed in. Please restart the app and sign in again."
            return
        }
        priorDate = nil
        winResult  = nil

        let store = GameStore(userId: userId)
        gameStore = store

        await store.startDaily(
            handUuid:    hand.uuid,
            shuffleSeed: hand.shuffleSeed,
            drawMode:    hand.drawMode,
            date:        dailyDate,
            isRanked:    !userHasRankedAttempt
        )
    }

    // MARK: - Clear active game (called when user abandons a prior-day replay)

    func clearGame() {
        gameStore = nil
        priorDate = nil
    }

    // MARK: - Cross-device daily resume (DEV-339)

    /// Looks for an in-progress daily session on the server (possibly paused on
    /// another device) so the lobby can offer to resume it. No-op if a daily game
    /// is already loaded locally.
    func checkActiveDailySession() async {
        guard userId > 0, gameStore == nil else { return }
        guard let response: ActiveSessionsResponse =
                try? await APIClient.shared.get("/api/v1/sessions/active") else { return }
        // Only surface a meaningful in-progress hand (>0 moves).
        if let daily = response.daily, daily.moves > 0 {
            activeDailySession = daily
        } else {
            activeDailySession = nil
        }
    }

    /// Resumes the in-progress daily session: replays its turns, restores the
    /// clock, and tags the GameStore with the session's date so a win lands on the
    /// correct day's leaderboard. Every daily attempt is ranked.
    func resumeActiveDaily() async {
        guard let item = activeDailySession else { return }
        winResult = nil

        let store = GameStore(userId: userId)
        store.dailyDate       = item.dailyDate          // for handleWin's leaderboard date
        store.isRankedSession = true                    // all daily attempts are ranked
        await store.resumeGame(item: item)              // sets state, session, clock, drawMode
        gameStore = store

        // Reflect a past-day resume in the header/banner; today's clears priorDate.
        if let d = item.dailyDate, !d.isEmpty, d != dailyDate {
            priorDate = d
        } else {
            priorDate = nil
        }
        activeDailySession = nil
    }

    /// Dismisses the resume banner without resuming (user chose to start fresh).
    func dismissActiveDailySession() {
        activeDailySession = nil
    }

    // MARK: - Restart the current daily hand (Daily "…" menu)

    /// Re-deals the hand currently in play as a brand-new session on the same
    /// hand + date. Every daily attempt — today's or any past day — is ranked and
    /// can be replayed to improve. Reuses the in-progress GameStore's hand so it
    /// works for both today's challenge and a prior-day replay.
    func restartCurrentHand() async {
        guard let gs = gameStore,
              let handUuid = gs.handUuid,
              let st = gs.state else { return }

        let drawMode  = st.drawMode
        let seed      = st.seed
        let date      = gs.dailyDate ?? dailyDate
        let wasPrior  = priorDate != nil

        await gs.abandonSession()

        winResult = nil
        let newStore = GameStore(userId: userId)
        gameStore = newStore
        priorDate = wasPrior ? date : nil

        await newStore.startDaily(
            handUuid:    handUuid,
            shuffleSeed: seed,
            drawMode:    drawMode,
            date:        date,
            isRanked:    true   // all daily attempts are ranked (server authoritative)
        )
    }

    // MARK: - Start prior daily game (DEV-277)

    func startPriorGame(handUuid: UUID, shuffleSeed: Int64, drawMode: String, date: String) async {
        guard userId > 0 else {
            handError = "Not signed in. Please restart the app and sign in again."
            return
        }
        priorDate = date
        winResult  = nil

        let store = GameStore(userId: userId)
        gameStore = store

        // Past dailies are ranked too — replay any day to improve your result.
        await store.startDaily(
            handUuid:    handUuid,
            shuffleSeed: shuffleSeed,
            drawMode:    drawMode,
            date:        date,
            isRanked:    true
        )
    }

    // MARK: - Handle win

    /// Called when GameStore.isWon becomes true.
    /// Submits the session and fetches the user's rank, then sets winResult.
    func handleWin() async {
        guard let store = gameStore else { return }
        guard winResult == nil else { return }   // guard against double-fire

        let moves       = store.state?.moveCount ?? 0
        let timeSeconds = store.elapsedSeconds
        let sessionUuid = store.sessionUuid
        let isRanked    = store.isRankedSession
        let date        = store.dailyDate ?? dailyDate
        let mode        = store.lastDrawMode

        // Submit the win
        await store.completeSession()

        // Fetch the user's rank (may fail silently — rank shown as nil)
        var rank: Int? = nil
        if userId > 0 {
            let sortParam = "moves"
            if let entry: DailyLeaderboardEntry = try? await APIClient.shared.get(
                "/api/v1/leaderboard/daily/\(date)/\(userId)/\(sortParam)",
                query: ["drawMode": mode]
            ) {
                rank = entry.rank
            }
        }

        winResult = DailyWinResult(
            moves:       moves,
            timeSeconds: timeSeconds,
            rank:        rank,
            sessionUuid: sessionUuid,
            isRanked:    isRanked,
            date:        date,
            drawMode:    mode
        )
    }

    // MARK: - Dismiss win and refresh

    func dismissWin() {
        winResult = nil
        // Refresh ranked status so the game tab updates its badge
        Task { await fetchToday() }
    }

    // MARK: - Fetch leaderboard

    func fetchLeaderboard(for date: String) async {
        isLoadingLeaderboard = true
        defer { isLoadingLeaderboard = false }

        let sort = leaderboardSort.rawValue
        do {
            leaderboard = try await APIClient.shared.get(
                "/api/v1/leaderboard/daily/\(date)/\(sort)",
                query: ["drawMode": drawMode]
            )
        } catch {
            leaderboard = []
        }

        // Fetch personal rank independently so leaderboard row can be highlighted
        if userId > 0 {
            myRank = try? await APIClient.shared.get(
                "/api/v1/leaderboard/daily/\(date)/\(userId)/\(sort)",
                query: ["drawMode": drawMode]
            )
        }
    }

    // MARK: - Fetch calendar

    func fetchCalendar() async {
        guard !isLoadingCalendar else { return }
        isLoadingCalendar = true
        defer { isLoadingCalendar = false }

        do {
            calendarEntries = try await APIClient.shared.get(
                "/api/v1/daily/calendar",
                query: ["drawMode": drawMode, "months": "12"]
            )
        } catch {
            calendarEntries = []
        }
    }

    // MARK: - Fetch past daily hand (for calendar tap → replay)

    /// Returns the DailyResponse for a past date so the caller can start a prior game.
    func fetchPastHand(date: String) async throws -> DailyResponse {
        try await APIClient.shared.get(
            "/api/v1/daily/\(date)",
            query: ["drawMode": drawMode]
        )
    }
}
