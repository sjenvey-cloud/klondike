import Foundation
import Observation

@MainActor
@Observable
final class GameStore {

    // MARK: - Published state

    var state: GameState?
    var sessionUuid: UUID?
    var handUuid: UUID?
    var isLoading = false
    var errorMessage: String?
    var elapsedSeconds: Int = 0
    var userId: Int   // mutable so ContentView can set it after login

    // MARK: - Derived

    var isWon: Bool { state?.isWon ?? false }
    var canUndo: Bool { !(state?.history.isEmpty ?? true) }
    var canAutoComplete: Bool { state?.canAutoComplete ?? false }
    var isAutoCompleting: Bool = false
    var lastDrawMode: String = "draw3"   // remembered across games

    /// Set when this store is running a daily challenge session.
    /// Used by DailyWinView to display ranked/practice badge and fetch rank.
    var isRankedSession: Bool = false
    var dailyDate: String? = nil

    // MARK: - Offline-first identity

    /// The deterministic seed of the current game (so results can be submitted from
    /// the seed alone, with no server session, when offline).
    private var currentSeed: Int64?
    /// Client-generated idempotency key for the current game. nil for a resumed
    /// session (which is submitted by its serverSessionUuid instead).
    private var currentClientId: UUID?

    // MARK: - Private

    private var timerTask: Task<Void, Never>?

    private static func randomSeed() -> Int64 {
        // xorshift32 seeds live in [1, 2^32) — match the server's valid range.
        Int64(UInt32.random(in: 1...UInt32.max))
    }

    // MARK: - Init

    init(userId: Int) {
        self.userId = userId
    }

    // MARK: - New Game

    /// Starts a new random game. The deal is generated locally and is instantly
    /// playable with no network — a server hand + session is registered in the
    /// background (for cross-device resume). Offline, that background step is simply
    /// skipped; the result still syncs later from the seed via the offline queue.
    func newGame(drawMode: String) async {
        guard userId > 0 else {
            errorMessage = "Not signed in. Please restart the app and sign in again."
            return
        }
        errorMessage = nil
        lastDrawMode = drawMode

        let seed     = Self.randomSeed()
        let clientId = UUID()

        state           = GameState(seed: seed, drawMode: drawMode)
        currentSeed     = seed
        currentClientId = clientId
        dailyDate       = nil
        isRankedSession = false
        handUuid        = nil
        sessionUuid     = nil
        elapsedSeconds  = 0
        stopTimer()
        startTimer()

        // Best-effort server registration (enables resume when online).
        Task { [weak self] in
            await self?.registerServerSession(
                seed: seed, drawMode: drawMode, clientId: clientId,
                isDaily: false, dailyDate: nil, isRanked: false, handUuid: nil)
        }
    }

    // MARK: - Server registration (best-effort, non-blocking)

    /// Creates the server hand (if needed) + session so an in-progress game can be
    /// resumed on another device. Failure is silent — play never depends on it, and
    /// the result is submitted from the seed by OfflineStore regardless.
    private func registerServerSession(
        seed: Int64, drawMode: String, clientId: UUID,
        isDaily: Bool, dailyDate: String?, isRanked: Bool, handUuid explicitHand: UUID?
    ) async {
        do {
            let handUuidResolved: UUID
            if let explicitHand {
                handUuidResolved = explicitHand           // daily/challenge hand already exists server-side
            } else {
                struct HandCreated: Decodable { let uuid: UUID; let shuffleSeed: Int64; let drawMode: String }
                let hand: HandCreated = try await APIClient.shared.post(
                    "/api/v1/hands",
                    body: CreateHandRequest(drawMode: drawMode, seed: seed))   // explicit-seed → matches our local deal
                handUuidResolved = hand.uuid
            }

            let resp: CreateSessionResponse = try await APIClient.shared.post(
                "/api/v1/sessions",
                body: CreateSessionRequest(
                    handUuid: handUuidResolved, userId: userId,
                    isDaily: isDaily, dailyDate: dailyDate, isRanked: isRanked,
                    clientId: clientId))

            // Only apply to the game that's still current (the user may have moved on).
            guard currentClientId == clientId else { return }
            self.handUuid    = handUuidResolved
            self.sessionUuid = resp.session.uuid
            if isDaily { self.isRankedSession = resp.isRanked }
        } catch {
            // Offline / transient — ignore.
        }
    }

    // MARK: - Start Daily Game (DEV-273)

    /// Starts a daily challenge session for a pre-fetched hand.
    /// Uses the `date` string from the backend response — never the device clock —
    /// so sessions are tagged with the correct challenge date past local midnight.
    func startDaily(
        handUuid: UUID,
        shuffleSeed: Int64,
        drawMode: String,
        date: String,
        isRanked: Bool
    ) async {
        guard userId > 0 else {
            errorMessage = "Not signed in. Please restart the app and sign in again."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        errorMessage = nil
        lastDrawMode = drawMode
        dailyDate = date

        let clientId = UUID()

        // Deal locally & immediately — playable even with no connection.
        state           = GameState(seed: shuffleSeed, drawMode: drawMode)
        currentSeed     = shuffleSeed
        currentClientId = clientId
        self.handUuid   = handUuid
        sessionUuid     = nil
        isRankedSession = isRanked           // provisional; server confirms in the background
        elapsedSeconds  = 0
        stopTimer()
        startTimer()

        // Best-effort server registration on the known daily hand (enables resume).
        Task { [weak self] in
            await self?.registerServerSession(
                seed: shuffleSeed, drawMode: drawMode, clientId: clientId,
                isDaily: true, dailyDate: date, isRanked: isRanked, handUuid: handUuid)
        }
    }

    // MARK: - Start Challenge Game (DEV-299)

    /// Starts a normal (non-daily) session on a specific challenge hand.
    /// Fetches the hand by UUID to recover its shuffle seed, then creates a session.
    /// On win, `completeSession()` submits it and the backend challenge leaderboard
    /// updates automatically (it ranks won sessions by hand).
    func startChallenge(handUuid challengeHandUuid: UUID, drawMode: String) async {
        guard userId > 0 else {
            errorMessage = "Not signed in. Please restart the app and sign in again."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        lastDrawMode = drawMode

        do {
            struct HandFetched: Decodable {
                let uuid: UUID
                let shuffleSeed: Int64
                let drawMode: String
            }
            let hand: HandFetched = try await APIClient.shared.get(
                "/api/v1/hands/\(challengeHandUuid.uuidString.lowercased())"
            )

            let clientId = UUID()
            let sessionResp: CreateSessionResponse = try await APIClient.shared.post(
                "/api/v1/sessions",
                body: CreateSessionRequest(
                    handUuid: hand.uuid,
                    userId: userId,
                    isDaily: false,
                    dailyDate: nil,
                    isRanked: false,
                    clientId: clientId
                )
            )

            state = GameState(seed: hand.shuffleSeed, drawMode: hand.drawMode)
            currentSeed = hand.shuffleSeed
            currentClientId = clientId
            handUuid = hand.uuid
            sessionUuid = sessionResp.session.uuid
            elapsedSeconds = 0
            stopTimer()
            startTimer()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Resume Game

    /// Resumes an existing session from an ActiveSessionItem.
    func resumeGame(item: ActiveSessionItem) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        var newState = GameState(seed: item.seed, drawMode: item.drawMode)
        if let turns = item.turns, !turns.isEmpty {
            newState.replay(turns: turns)
        }
        state = newState
        handUuid = item.handUuid
        sessionUuid = item.uuid
        currentSeed = item.seed
        currentClientId = nil          // resumed session → submitted by its serverSessionUuid
        dailyDate = item.dailyDate

        // DEV-338: resume the clock from the SAVED elapsed time, not from startedAt —
        // otherwise time spent paused / on another device would be counted.
        lastDrawMode = item.drawMode
        elapsedSeconds = max(0, item.timeSeconds)

        stopTimer()
        startTimer()
    }

    // MARK: - Save progress (DEV-338, cross-device resume)

    /// Snapshots the in-progress game (moves + elapsed + move history) to the server
    /// so it can be resumed on another device. Called when the app is backgrounded.
    /// No-op for a finished game or an untouched fresh deal.
    func saveProgress() async {
        guard let uuid = sessionUuid, let s = state, !s.isWon, s.moveCount > 0 else { return }
        do {
            try await APIClient.shared.postBodyVoid(
                "/api/v1/sessions/\(uuid)/progress",
                body: CompleteSessionRequest(
                    moves: s.moveCount,
                    timeSeconds: elapsedSeconds,
                    turns: s.turns
                )
            )
        } catch {
            // Best-effort — losing one snapshot just means resuming from the prior one.
        }
    }

    // MARK: - Move methods (delegate to state)

    func draw() {
        state?.draw()
    }

    @discardableResult
    func moveWasteToTableau(col: Int) -> Bool {
        state?.moveWasteToTableau(col: col) ?? false
    }

    @discardableResult
    func moveWasteToFoundation() -> Bool {
        state?.moveWasteToFoundation() ?? false
    }

    @discardableResult
    func moveTableau(fromCol: Int, fromIdx: Int, toCol: Int) -> Bool {
        state?.moveTableau(fromCol: fromCol, fromIdx: fromIdx, toCol: toCol) ?? false
    }

    @discardableResult
    func moveTableauToFoundation(col: Int) -> Bool {
        state?.moveTableauToFoundation(col: col) ?? false
    }

    @discardableResult
    func moveFoundationToTableau(foundationIdx: Int, toCol: Int) -> Bool {
        state?.moveFoundationToTableau(foundationIdx: foundationIdx, toCol: toCol) ?? false
    }

    func undo() {
        state?.undo()
    }

    // MARK: - Auto-complete

    /// Sweeps every remaining card to the foundations once the board has no
    /// face-down cards. Plays one move at a time with a short delay so the user
    /// sees the cards fly home; the win flow triggers naturally when `isWon`.
    /// Cycles the stock/waste as needed and stops gracefully if it can't progress.
    func autoComplete() async {
        guard state?.canAutoComplete == true, !isAutoCompleting else { return }
        isAutoCompleting = true
        defer { isAutoCompleting = false }

        var idleDraws = 0
        while let current = state, !current.isWon {
            // 1. Play anything available straight to a foundation.
            if playAnyToFoundation() {
                idleDraws = 0
                try? await Task.sleep(for: .milliseconds(80))
                continue
            }
            // 2. Nothing playable — cycle the draw pile to expose more cards.
            let remaining = current.stock.count + current.waste.count
            if remaining > 0 && idleDraws <= remaining {
                draw()
                idleDraws += 1
                try? await Task.sleep(for: .milliseconds(55))
                continue
            }
            // 3. A full cycle yielded no foundation move — stop (rare; user finishes by hand).
            break
        }
    }

    @discardableResult
    private func playAnyToFoundation() -> Bool {
        if moveWasteToFoundation() { return true }
        for col in 0..<7 where moveTableauToFoundation(col: col) { return true }
        return false
    }

    // MARK: - Complete Session

    /// Records a win. The result is written to the durable offline queue first (so it
    /// can never be lost to a flaky/absent connection — the old "couldn't save" false
    /// error) and synced in the background. Sync is idempotent, so a slow/lost response
    /// is retried safely rather than surfaced as an error.
    func completeSession() async {
        guard let s = state else { return }
        stopTimer()

        enqueueResult(status: "won", state: s)
        Task { await OfflineStore.shared.flush() }

        // Game Center: the Daily Challenge feeds two recurring daily leaderboards —
        // fewest moves and fastest time. Only daily wins count (dailyDate set);
        // no-op when GC isn't authenticated or offline.
        if s.isWon, dailyDate != nil {
            await GameCenterService.shared.submitDailyResult(
                moves: s.moveCount, timeSeconds: elapsedSeconds)
        }
    }

    /// Build a durable PendingResult for the current game and enqueue it. Uses the
    /// clientId when we have one (online or offline games we created), otherwise the
    /// resumed session's serverSessionUuid.
    private func enqueueResult(status: String, state s: GameState) {
        guard let seed = currentSeed else { return }
        let result = PendingResult(
            clientId: currentClientId,
            serverSessionUuid: currentClientId == nil ? sessionUuid : nil,
            seed: seed,
            drawMode: s.drawMode,
            isDaily: dailyDate != nil,
            dailyDate: dailyDate,
            status: status,
            moves: s.moveCount,
            timeSeconds: elapsedSeconds,
            turns: s.turns,
            createdAt: Date())
        OfflineStore.shared.enqueue(result)
    }

    // MARK: - Redeal

    /// Abandons the current session and starts a brand-new session for the
    /// same hand (same seed / draw mode), resetting the board to deal-order.
    func redeal() async {
        guard let currentState = state else { return }

        errorMessage = nil
        stopTimer()

        // Record the abandoned attempt (durably; guarded so a fresh deal isn't logged).
        if currentState.moveCount >= 2 {
            enqueueResult(status: "abandoned", state: currentState)
            Task { await OfflineStore.shared.flush() }
        }

        // Fresh deal of the SAME hand (seed/draw mode) with a new identity.
        let seed     = currentState.seed
        let drawMode = currentState.drawMode
        let isDaily  = dailyDate != nil
        let date     = dailyDate
        let existingHand = handUuid            // known for daily/challenge/online-registered games
        let clientId = UUID()

        state           = GameState(seed: seed, drawMode: drawMode)
        currentSeed     = seed
        currentClientId = clientId
        sessionUuid     = nil
        elapsedSeconds  = 0
        startTimer()

        Task { [weak self] in
            await self?.registerServerSession(
                seed: seed, drawMode: drawMode, clientId: clientId,
                isDaily: isDaily, dailyDate: date, isRanked: isDaily, handUuid: existingHand)
        }
    }

    // MARK: - Abandon Session

    /// Abandons the current session on the server.
    /// Clears a finished game from the board locally — no server call, since a won
    /// game is already submitted via completeSession. Returns the Game tab to its
    /// empty state so the win sheet dismisses (its binding follows `isWon`).
    func clearBoard() {
        stopTimer()
        state = nil
        sessionUuid = nil
        handUuid = nil
        currentSeed = nil
        currentClientId = nil
        elapsedSeconds = 0
    }

    /// Abandons the current game. The partial result is queued (durably) so it records
    /// even offline, then the board is cleared locally. A barely-started deal isn't
    /// recorded (matches the server's `moves >= 2` filters).
    func abandonSession() async {
        if let s = state, s.moveCount >= 2 {
            stopTimer()
            enqueueResult(status: "abandoned", state: s)
            Task { await OfflineStore.shared.flush() }
        }
        stopTimer()
        state = nil
        sessionUuid = nil
        handUuid = nil
        currentSeed = nil
        currentClientId = nil
        elapsedSeconds = 0
    }

    // MARK: - Timer

    private func startTimer() {
        timerTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                if Task.isCancelled { break }
                elapsedSeconds += 1   // already on @MainActor
            }
        }
    }

    private func stopTimer() {
        timerTask?.cancel()
        timerTask = nil
    }
}
