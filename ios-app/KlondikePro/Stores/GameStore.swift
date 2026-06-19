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

    // MARK: - Private

    private var timerTask: Task<Void, Never>?

    // MARK: - Init

    init(userId: Int) {
        self.userId = userId
    }

    // MARK: - New Game

    /// Creates a new hand on the server and starts a session.
    func newGame(drawMode: String) async {
        guard userId > 0 else {
            errorMessage = "Not signed in. Please restart the app and sign in again."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        lastDrawMode = drawMode

        do {
            // Inline struct — HandResponse has no `id` field
            struct HandCreated: Decodable {
                let uuid: UUID
                let shuffleSeed: Int64
                let drawMode: String
            }

            let hand: HandCreated = try await APIClient.shared.post(
                "/api/v1/hands",
                body: CreateHandRequest(drawMode: drawMode)
            )

            let sessionResp: CreateSessionResponse = try await APIClient.shared.post(
                "/api/v1/sessions",
                body: CreateSessionRequest(
                    handUuid: hand.uuid,
                    userId: userId,
                    isDaily: false,
                    dailyDate: nil,
                    isRanked: false
                )
            )

            let newState = GameState(seed: hand.shuffleSeed, drawMode: hand.drawMode)
            state = newState
            handUuid = hand.uuid
            sessionUuid = sessionResp.session.uuid
            elapsedSeconds = 0
            stopTimer()
            startTimer()
        } catch {
            errorMessage = error.localizedDescription
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

        lastDrawMode = drawMode
        dailyDate = date

        do {
            let sessionResp: CreateSessionResponse = try await APIClient.shared.post(
                "/api/v1/sessions",
                body: CreateSessionRequest(
                    handUuid: handUuid,
                    userId: userId,
                    isDaily: true,
                    dailyDate: date,
                    isRanked: isRanked
                )
            )

            // Honour the server's isRanked decision — it may downgrade if the user
            // already has a ranked win for this date and draw mode.
            isRankedSession = sessionResp.isRanked

            let newState = GameState(seed: shuffleSeed, drawMode: drawMode)
            state = newState
            self.handUuid = handUuid
            sessionUuid = sessionResp.session.uuid
            elapsedSeconds = 0
            stopTimer()
            startTimer()
        } catch {
            errorMessage = error.localizedDescription
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

            let sessionResp: CreateSessionResponse = try await APIClient.shared.post(
                "/api/v1/sessions",
                body: CreateSessionRequest(
                    handUuid: hand.uuid,
                    userId: userId,
                    isDaily: false,
                    dailyDate: nil,
                    isRanked: false
                )
            )

            state = GameState(seed: hand.shuffleSeed, drawMode: hand.drawMode)
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

    /// Submits a win to the server.
    func completeSession() async {
        guard let uuid = sessionUuid, let s = state else { return }
        stopTimer()
        do {
            let _: CompleteSessionResponse = try await APIClient.shared.post(
                "/api/v1/sessions/\(uuid)/complete",
                body: CompleteSessionRequest(
                    moves: s.moveCount,
                    timeSeconds: elapsedSeconds,
                    turns: s.turns
                )
            )
        } catch {
            // Silently swallow — win already shown to user
        }
        // Game Center: the Daily Challenge feeds two recurring daily leaderboards —
        // fewest moves and fastest time. Only daily wins count (dailyDate set);
        // no-op when GC isn't authenticated.
        if s.isWon, dailyDate != nil {
            await GameCenterService.shared.submitDailyResult(
                moves: s.moveCount, timeSeconds: elapsedSeconds)
        }
    }

    // MARK: - Redeal

    /// Abandons the current session and starts a brand-new session for the
    /// same hand (same seed / draw mode), resetting the board to deal-order.
    func redeal() async {
        guard let currentHandUuid = handUuid,
              let currentState    = state else { return }

        isLoading     = true
        errorMessage  = nil
        defer { isLoading = false }

        stopTimer()

        // Silently abandon the active session so it doesn't dangle on the server
        if let uuid = sessionUuid {
            do {
                let _: CompleteSessionResponse = try await APIClient.shared.post(
                    "/api/v1/sessions/\(uuid)/abandon",
                    body: AbandonSessionRequest(
                        moves: currentState.moveCount,
                        timeSeconds: elapsedSeconds,
                        turns: currentState.turns
                    )
                )
            } catch { /* swallow — redeal continues regardless */ }
        }

        // Open a fresh session for the same hand
        do {
            let sessionResp: CreateSessionResponse = try await APIClient.shared.post(
                "/api/v1/sessions",
                body: CreateSessionRequest(
                    handUuid: currentHandUuid,
                    userId: userId,
                    isDaily: false,
                    dailyDate: nil,
                    isRanked: false
                )
            )
            state       = GameState(seed: currentState.seed, drawMode: currentState.drawMode)
            sessionUuid = sessionResp.session.uuid
            elapsedSeconds = 0
            startTimer()
        } catch {
            errorMessage = error.localizedDescription
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
        elapsedSeconds = 0
    }

    func abandonSession() async {
        guard let uuid = sessionUuid, let s = state else { return }
        stopTimer()
        do {
            let _: CompleteSessionResponse = try await APIClient.shared.post(
                "/api/v1/sessions/\(uuid)/abandon",
                body: AbandonSessionRequest(
                    moves: s.moveCount,
                    timeSeconds: elapsedSeconds,
                    turns: s.turns
                )
            )
        } catch {
            // Silently swallow
        }
        state = nil
        sessionUuid = nil
        handUuid = nil
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
