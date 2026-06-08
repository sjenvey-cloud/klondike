import SwiftUI

/// DEV-273 + DEV-278 — The "Game" tab inside DailyView.
///
/// Shows the draw-mode selector and starts/resumes today's daily game.
/// When the user wins, triggers DailyStore.handleWin() which submits the
/// session and fetches rank, then presents DailyWinView.
struct DailyGameTab: View {

    @Environment(DailyStore.self) private var store
    @Environment(PreferencesStore.self) private var prefs
    @Environment(\.feltColor) private var feltColor
    @State private var showMenu = false
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
            .environment(prefs)
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
        .background(feltColor)
        .onChange(of: gameStore.isWon) { _, won in
            if won {
                Task { await store.handleWin() }
            }
        }
        .sheet(isPresented: $showMenu) {
            DailyGameMenuView(store: store, gameStore: gameStore)
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

            Button { showMenu = true } label: {
                Image(systemName: "ellipsis.circle").font(.title3)
            }
            .padding(.leading, 4)
            .foregroundStyle(.white)
            .accessibilityLabel("Daily game menu")
        }
    }

    // MARK: - Pre-game lobby

    private var lobby: some View {
        ScrollView {
            VStack(spacing: 32) {
                Spacer(minLength: 24)

                // ── Cross-device resume banner (DEV-339) ─────────────────
                if let active = store.activeDailySession {
                    DailyResumeBanner(
                        session: active,
                        onResume: { Task { await store.resumeActiveDaily() } },
                        onDismiss: { store.dismissActiveDailySession() }
                    )
                    .padding(.horizontal, 24)
                }

                // Icon
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 56))
                    .foregroundStyle(.yellow.opacity(0.85))

                // Status — today's daily allows unlimited ranked retries.
                VStack(spacing: 8) {
                    Text("Ready to play")
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                    Text("Every attempt is ranked — replay as often as you like and your best result counts toward the leaderboard.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.6))
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 24)

                // Draw mode selector (DEV-278)
                drawModeSelector

                // Start button
                Button {
                    Task { await store.startGame() }
                } label: {
                    Label("Play Today's Challenge", systemImage: "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                }
                .buttonStyle(.borderedProminent)
                .tint(.yellow)
                .foregroundStyle(.black)
                .padding(.horizontal, 32)
                .accessibilityLabel("Start today's ranked daily challenge")

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

// MARK: - Daily resume banner (DEV-339)

/// Shown in the lobby when an in-progress daily session exists on the server
/// (possibly paused on another device). Resume replays it with the clock intact;
/// dismiss hides it so the user can start today's challenge fresh below.
private struct DailyResumeBanner: View {
    let session: ActiveSessionItem
    var onResume: () -> Void
    var onDismiss: () -> Void

    private var timeLabel: String {
        String(format: "%d:%02d", session.timeSeconds / 60, session.timeSeconds % 60)
    }

    private var metaLabel: String {
        let base = "\(session.moves) moves · \(timeLabel) · \(session.drawMode.uppercased())"
        if let d = session.dailyDate, !d.isEmpty { return base + " · \(d)" }
        return base
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Daily in progress")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                    Text(metaLabel)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.white.opacity(0.4))
                }
                .accessibilityLabel("Dismiss; start a fresh attempt instead")
            }

            Button(action: onResume) {
                Label("Resume", systemImage: "play.fill")
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.yellow)
            .foregroundStyle(.black)
        }
        .padding(16)
        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.yellow.opacity(0.4)))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Daily challenge in progress: \(session.moves) moves. Resume, or dismiss to play fresh.")
    }
}

// MARK: - Daily game menu

/// The "…" menu for the Daily Challenge board. Mirrors the random-game menu but
/// without "New Game" — the daily hand is fixed. Restart re-deals the *same*
/// daily hand as a fresh session (today's stays ranked; a past daily stays practice).
private struct DailyGameMenuView: View {
    let store: DailyStore
    let gameStore: GameStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button {
                    gameStore.undo()
                    dismiss()
                } label: {
                    Label("Undo", systemImage: "arrow.uturn.backward")
                }
                .disabled(!gameStore.canUndo)

                Button {
                    Task { await store.restartCurrentHand() }
                    dismiss()
                } label: {
                    Label("Restart Hand", systemImage: "arrow.clockwise")
                }

                Button(role: .destructive) {
                    Task {
                        await gameStore.abandonSession()
                        store.clearGame()
                    }
                    dismiss()
                } label: {
                    Label("Abandon Game", systemImage: "xmark.circle")
                }

                Button { dismiss() } label: {
                    Label("Close", systemImage: "xmark")
                }
            }
            .navigationTitle("Daily Menu")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
