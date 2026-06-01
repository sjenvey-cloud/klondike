import SwiftUI

// MARK: - ReplayView (DEV-306)

/// Session replay viewer.
///
/// Fetches GET /api/v1/sessions/{uuid}/replay, builds an array of GameState
/// snapshots by applying each move in order, then lets the user step through
/// them using transport controls (⏮ ⏪ ▶ ⏩ ⏭) with optional auto-play.
struct ReplayView: View {

    let sessionUuid: UUID

    @Environment(\.dismiss) private var dismiss
    @State private var snapshots:    [GameState] = []
    @State private var currentStep:  Int         = 0
    @State private var isPlaying:    Bool         = false
    @State private var speed:        Double       = 1.0     // moves per second
    @State private var isLoading:    Bool         = true
    @State private var errorMessage: String?      = nil
    @State private var playTask:     Task<Void, Never>? = nil

    private var totalMoves: Int { max(0, snapshots.count - 1) }
    private var canStepBack: Bool { currentStep > 0 }
    private var canStepForward: Bool { currentStep < totalMoves }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

                if isLoading {
                    loadingView

                } else if let error = errorMessage {
                    errorView(message: error)

                } else if let state = currentState {
                    VStack(spacing: 0) {
                        // Move counter
                        stepCounter
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                            .padding(.bottom, 8)

                        // Board (read-only)
                        ReplayBoardView(state: state)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)

                        // Transport controls
                        controls
                            .padding(16)
                    }
                }
            }
            .navigationTitle("Replay")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        stopPlayback()
                        dismiss()
                    }
                    .foregroundStyle(.yellow)
                }
            }
        }
        .task { await loadReplay() }
        .onDisappear { stopPlayback() }
    }

    // MARK: - Loading / error

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(.yellow)
                .scaleEffect(1.4)
            Text("Loading replay…")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.5))
        }
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 44))
                .foregroundStyle(.orange)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Close") { dismiss() }
                .buttonStyle(.bordered)
                .tint(.yellow)
                .foregroundStyle(.yellow)
        }
    }

    // MARK: - Step counter

    private var stepCounter: some View {
        HStack {
            Text("Move \(currentStep) of \(totalMoves)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.white.opacity(0.6))

            Spacer()

            // Speed selector
            Menu {
                ForEach([0.5, 1.0, 2.0, 4.0], id: \.self) { s in
                    Button {
                        speed = s
                        if isPlaying { restartPlayback() }
                    } label: {
                        Label(
                            "\(s == 0.5 ? "0.5" : String(Int(s)))× speed",
                            systemImage: speed == s ? "checkmark" : ""
                        )
                    }
                }
            } label: {
                Label("\(speed == 0.5 ? "0.5" : String(Int(speed)))×",
                      systemImage: "speedometer")
                    .font(.caption.bold())
                    .foregroundStyle(.yellow)
            }
        }
    }

    // MARK: - Transport controls

    private var controls: some View {
        VStack(spacing: 12) {
            // Progress scrubber
            if totalMoves > 0 {
                Slider(
                    value: Binding(
                        get: { Double(currentStep) },
                        set: { v in
                            let newStep = Int(v.rounded())
                            if newStep != currentStep {
                                stopPlayback()
                                currentStep = newStep
                            }
                        }
                    ),
                    in: 0...Double(totalMoves),
                    step: 1
                )
                .tint(.yellow)
                .accessibilityLabel("Move scrubber: move \(currentStep) of \(totalMoves)")
            }

            // Transport buttons
            HStack(spacing: 20) {
                // ⏮ First
                transportButton(icon: "backward.end.fill") {
                    stopPlayback(); currentStep = 0
                }
                .disabled(!canStepBack)

                // ⏪ Step back
                transportButton(icon: "backward.frame.fill") {
                    stopPlayback()
                    if canStepBack { currentStep -= 1 }
                }
                .disabled(!canStepBack)

                // ▶️ / ⏸ Play / Pause
                Button {
                    isPlaying ? stopPlayback() : startPlayback()
                } label: {
                    Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 52))
                        .foregroundStyle(.yellow)
                }
                .disabled(totalMoves == 0)
                .accessibilityLabel(isPlaying ? "Pause replay" : "Play replay")

                // ⏩ Step forward
                transportButton(icon: "forward.frame.fill") {
                    stopPlayback()
                    if canStepForward { currentStep += 1 }
                }
                .disabled(!canStepForward)

                // ⏭ Last
                transportButton(icon: "forward.end.fill") {
                    stopPlayback(); currentStep = totalMoves
                }
                .disabled(!canStepForward)
            }
        }
        .padding(.horizontal, 8)
        .padding(16)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func transportButton(icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 26))
                .foregroundStyle(.white.opacity(0.8))
        }
        .accessibilityLabel(icon)
    }

    // MARK: - Playback

    private func startPlayback() {
        guard canStepForward else { return }
        isPlaying = true
        playTask = Task { @MainActor in
            while !Task.isCancelled && currentStep < totalMoves {
                let delay: UInt64 = UInt64(max(100_000_000, UInt64(1_000_000_000 / speed)))
                try? await Task.sleep(nanoseconds: delay)
                guard !Task.isCancelled else { break }
                if currentStep < totalMoves {
                    currentStep += 1
                } else {
                    break
                }
            }
            isPlaying = false
        }
    }

    private func stopPlayback() {
        playTask?.cancel()
        playTask = nil
        isPlaying = false
    }

    private func restartPlayback() {
        stopPlayback()
        startPlayback()
    }

    // MARK: - Current state

    private var currentState: GameState? {
        guard !snapshots.isEmpty, currentStep < snapshots.count else { return nil }
        return snapshots[currentStep]
    }

    // MARK: - Load & build snapshots

    private func loadReplay() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: ReplayResponse = try await APIClient.shared.get(
                "/api/v1/sessions/\(sessionUuid.uuidString.lowercased())/replay"
            )
            snapshots = buildSnapshots(from: response)
        } catch let apiErr as APIError {
            switch apiErr {
            case .httpError(422, _):
                errorMessage = "Only completed (won) sessions can be replayed."
            case .httpError(404, _):
                errorMessage = "Session not found."
            default:
                errorMessage = "Could not load replay. Check your connection."
            }
        } catch {
            errorMessage = "Could not load replay. Check your connection."
        }
    }

    /// Build an array of GameState snapshots: one per move, starting from the initial deal.
    private func buildSnapshots(from response: ReplayResponse) -> [GameState] {
        var state = GameState(cardIDs: response.cards, drawMode: response.drawMode)
        var result: [GameState] = [state]

        for move in response.moves {
            applyMove(move, to: &state)
            state.clearHistory()   // avoid quadratic memory growth
            result.append(state)
        }
        return result
    }

    private func applyMove(_ move: ReplayMove, to state: inout GameState) {
        switch move.type {
        case "draw":
            state.draw()

        case "wf":
            state.moveWasteToFoundation()

        case "wt":
            if let col = move.col {
                state.moveWasteToTableau(col: col)
            }

        case "tf":
            if let col = move.col {
                state.moveTableauToFoundation(col: col)
            }

        case "tt":
            guard let fromCol = move.fromCol, let toCol = move.toCol else { break }
            let fromIdx = move.fromIdx ?? inferFirstFaceUpIdx(in: state.tableau[fromCol])
            state.moveTableau(fromCol: fromCol, fromIdx: fromIdx, toCol: toCol)

        case "ft":
            if let fi = move.foundationIdx, let toCol = move.toCol {
                state.moveFoundationToTableau(foundationIdx: fi, toCol: toCol)
            }

        default:
            break
        }
    }

    /// Fall-back for legacy "tt:fromCol:toCol" (no fromIdx) — find first face-up card.
    private func inferFirstFaceUpIdx(in column: [Card]) -> Int {
        column.indices.first { column[$0].isFaceUp } ?? 0
    }
}
