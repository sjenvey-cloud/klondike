import SwiftUI

/// DEV-273 + DEV-278 — The "Game" tab inside DailyView.
///
/// Shows the draw-mode selector and starts/resumes today's daily game.
/// When the user wins, triggers DailyStore.handleWin() which submits the
/// session and fetches rank, then presents DailyWinView.
struct DailyGameTab: View {

    @Environment(DailyStore.self) private var store
    var onSwitchToLeaderboard: () -> Void

    var body: some View {
        ZStack {
            if store.isLoadingHand {
                loadingView

            } else if let errorMsg = store.handError {
                errorView(message: errorMsg)

            } else if let gameStore = store.gameStore, gameStore.state != nil {
                // ── Live daily board ─────────────────────────────────────
                liveGame(gameStore: gameStore)

            } else {
                // ── Pre-game lobby ───────────────────────────────────────
                lobby
            }
        }
        .sheet(item: Binding<DailyWinResult?>(
            get: { store.winResult },
            set: { if $0 == nil { store.dismissWin() } }
        )) { result in
            DailyWinView(
                result: result,
                onLeaderboard: {
                    store.dismissWin()
                    onSwitchToLeaderboard()
                }
            )
        }
    }

    // MARK: - Live game board

    private func liveGame(gameStore: GameStore) -> some View {
        GeometryReader { proxy in
            VStack(spacing: 0) {
                // Prior daily banner (when replaying a past challenge from calendar)
                if let prior = store.priorDate {
                    priorBanner(date: prior, gameStore: gameStore)
                }

                // Stats bar
                dailyStatsBar(gameStore: gameStore)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)

                // Board
                let totalSpacing: CGFloat = 16 * 2 + 6 * 2
                let cardWidth = (proxy.size.width - totalSpacing) / 7
                BoardView(store: gameStore, cardWidth: max(36, cardWidth))
            }
        }
        .background(Color(red: 0.05, green: 0.07, blue: 0.10))
        .onChange(of: gameStore.isWon) { _, won in
            if won {
                Task { await store.handleWin() }
            }
        }
    }

    // MARK: - Prior daily banner

    private func priorBanner(date: String, gameStore: GameStore) -> some View {
        HStack {
            Button {
                Task {
                    await gameStore.abandonSession()
                    store.clearGame()
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.footnote.bold())
                    Text("Today's Daily")
                        .font(.footnote.bold())
                }
                .foregroundStyle(.yellow)
            }
            .accessibilityLabel("Return to today's daily challenge")

            Spacer()

            Text(date)
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.6))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.06))
    }

    // MARK: - Stats bar

    private func dailyStatsBar(gameStore: GameStore) -> some View {
        HStack {
            // Ranked / Practice badge
            Text(gameStore.isRankedSession ? "Ranked" : "Practice")
                .font(.caption.bold())
                .foregroundStyle(gameStore.isRankedSession ? .black : .white.opacity(0.7))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(gameStore.isRankedSession ? Color.yellow : Color.white.opacity(0.15))
                .clipShape(Capsule())
                .accessibilityLabel(gameStore.isRankedSession ? "Ranked attempt" : "Practice attempt")

            Spacer()

            Text(timerText(gameStore.elapsedSeconds))
                .font(.system(.body, design: .monospaced).bold())
                .foregroundStyle(.white)

            Spacer()

            Text("\(gameStore.state?.moveCount ?? 0) moves")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))

            Button { gameStore.undo() } label: {
                Image(systemName: "arrow.uturn.backward").font(.title3)
            }
            .disabled(!gameStore.canUndo)
            .padding(.leading, 8)
            .foregroundStyle(gameStore.canUndo ? .white : .white.opacity(0.3))
            .accessibilityLabel("Undo last move")
        }
    }

    // MARK: - Pre-game lobby

    private var lobby: some View {
        ScrollView {
            VStack(spacing: 32) {
                Spacer(minLength: 24)

                // Icon
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 56))
                    .foregroundStyle(.yellow.opacity(0.85))

                // Status
                VStack(spacing: 8) {
                    if store.userHasRankedAttempt {
                        Label("Completed today", systemImage: "checkmark.seal.fill")
                            .font(.headline)
                            .foregroundStyle(.yellow)
                        Text("You've already submitted a ranked result.\nPlay again for practice.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.6))
                            .multilineTextAlignment(.center)
                    } else {
                        Text("Ready to play")
                            .font(.title3.bold())
                            .foregroundStyle(.white)
                        Text("Your first completion counts toward the leaderboard.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.6))
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 24)

                // Draw mode selector (DEV-278)
                drawModeSelector

                // Start button
                Button {
                    Task { await store.startGame() }
                } label: {
                    Label(
                        store.userHasRankedAttempt ? "Play Again (Practice)" : "Play Today's Challenge",
                        systemImage: "play.fill"
                    )
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                }
                .buttonStyle(.borderedProminent)
                .tint(.yellow)
                .foregroundStyle(.black)
                .padding(.horizontal, 32)
                .accessibilityLabel(
                    store.userHasRankedAttempt
                        ? "Play today's challenge again as practice"
                        : "Start today's ranked daily challenge"
                )

                Spacer(minLength: 32)
            }
        }
    }

    // MARK: - Draw mode selector (DEV-278)

    private var drawModeSelector: some View {
        VStack(spacing: 8) {
            Text("Draw Mode")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.5))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 32)

            HStack(spacing: 0) {
                modeButton("Draw 1", mode: "draw1")
                modeButton("Draw 3", mode: "draw3")
            }
            .background(Color.white.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 32)
        }
    }

    private func modeButton(_ label: String, mode: String) -> some View {
        let active = store.drawMode == mode
        return Button {
            store.selectDrawMode(mode)
        } label: {
            Text(label)
                .font(.subheadline.weight(active ? .bold : .regular))
                .foregroundStyle(active ? .black : .white.opacity(0.65))
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(active ? Color.yellow : Color.clear)
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .animation(.easeInOut(duration: 0.15), value: active)
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }

    // MARK: - Loading / error states

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.4)
                .tint(.yellow)
            Text("Loading today's challenge…")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))
        }
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 24) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 48))
                .foregroundStyle(.white.opacity(0.4))

            VStack(spacing: 8) {
                Text("Challenge Unavailable")
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Button {
                Task { await store.fetchToday() }
            } label: {
                Label("Try Again", systemImage: "arrow.clockwise")
                    .font(.headline)
                    .frame(width: 200, height: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(.yellow)
            .foregroundStyle(.black)
        }
    }

    // MARK: - Helpers

    private func timerText(_ seconds: Int) -> String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}
