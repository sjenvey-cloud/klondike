import Foundation
import Observation

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

    // MARK: - Private

    private var timerTask: Task<Void, Never>?

    // MARK: - Init

    init(userId: Int) {
        self.userId = userId
    }

    // MARK: - New Game

    /// Creates a new hand on the server and starts a session.
    func newGame(drawMode: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

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

    // MARK: - Resume Game

    /// Resumes an existing session from an ActiveSessionItem.
    func resumeGame(item: ActiveSessionItem) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        var newState = GameState(seed: item.seed, drawMode: item.drawMode)
        if !item.turns.isEmpty {
            newState.replay(turns: item.turns)
        }
        state = newState
        handUuid = item.handUuid
        sessionUuid = item.uuid

        // Compute elapsed seconds from how long ago the session started
        let elapsed = Int(Date().timeIntervalSince(item.startedAt))
        elapsedSeconds = max(0, elapsed)

        stopTimer()
        startTimer()
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
    }

    // MARK: - Abandon Session

    /// Abandons the current session on the server.
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
                await MainActor.run { elapsedSeconds += 1 }
            }
        }
    }

    private func stopTimer() {
        timerTask?.cancel()
        timerTask = nil
    }
}
