import SwiftUI

/// Top-level game view: stats bar + board + win/menu sheets.
struct GameView: View {

    let store: GameStore
    /// When true (the main Game tab), the empty state offers to resume an
    /// in-progress server session — matching the Home tab's resume banner
    /// (DEV-345). Left false for reused GameViews (challenge / daily covers),
    /// which manage their own hand and must not surface a random-game resume.
    var showsResume: Bool = false

    @State private var showMenu = false
    @State private var activeSession: ActiveSessionItem?

    @Environment(\.feltColor) private var feltColor
    @Environment(PreferencesStore.self) private var prefs
    @Environment(AuthStore.self) private var authStore
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            feltColor.ignoresSafeArea()

            if store.isLoading {
                // ── Dealing in progress ──────────────────────────────────
                dealingView

            } else if store.state != nil {
                // ── Live game board ──────────────────────────────────────
                // No NavigationStack needed here — this view has no nav destinations
                // and the deprecated .navigationBarHidden(true) can leave an invisible
                // touch-absorbing bar region.
                VStack(spacing: 0) {
                    statsBar
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)

                    GeometryReader { proxy in
                        let totalSpacing: CGFloat = 16 * 2 + 6 * 2
                        let raw = (proxy.size.width - totalSpacing) / 7
                        // DEV-316: cap so cards don't become oversized on iPad/landscape.
                        let cardWidth = min(max(36, raw), 104)
                        BoardView(store: store, cardWidth: cardWidth)
                    }
                }
                .background(feltColor)
                .background(keyboardShortcuts)   // DEV-318: iPad hardware-keyboard shortcuts
                .sheet(isPresented: winBinding) {
                    WinView(
                        store: store,
                        drawMode: store.state?.drawMode ?? store.lastDrawMode,
                        onNewGame: {},
                        canChallenge: showsResume   // main random Game tab only
                    )
                    .environment(prefs)
                }
                .sheet(isPresented: $showMenu) {
                    GameMenuView(store: store)
                }

            } else {
                // ── No game in progress ──────────────────────────────────
                noGameView
            }

            // ── Error banner (floats above everything) ───────────────────
            // The Spacer is non-interactive so touches on the game board
            // below the banner still register while the error is visible.
            if let msg = store.errorMessage {
                VStack {
                    errorBanner(msg)
                    Spacer()
                        .allowsHitTesting(false)
                }
            }
        }
        // DEV-345: keep the resume option in sync with the server on the Game tab.
        .task {
            if showsResume, store.state == nil, authStore.user != nil {
                await checkActiveSession()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if showsResume, phase == .active, store.state == nil, authStore.user != nil {
                Task { await checkActiveSession() }
            }
        }
        // When a game ends (state → nil), re-check so a still-active session on
        // another device surfaces, and a just-finished hand stops offering resume.
        .onChange(of: store.state != nil) { _, hasGame in
            if showsResume, !hasGame, authStore.user != nil {
                Task { await checkActiveSession() }
            }
        }
    }

    // MARK: - No-game empty state

    private var noGameView: some View {
        VStack(spacing: 32) {
            Spacer()

            // DEV-345: offer to resume an in-progress server session — parity with
            // the Home tab's resume banner.
            if showsResume, let active = activeSession {
                resumeCard(active)
            }

            Image(systemName: "suit.spade.fill")
                .font(.system(size: 64))
                .foregroundStyle(.yellow.opacity(0.8))

            VStack(spacing: 8) {
                Text("No game in progress")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text("Start a new game from the Home tab,\nor tap below.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
            }

            Button {
                Task { await store.newGame(drawMode: store.lastDrawMode) }
            } label: {
                Label("New Game", systemImage: "play.fill")
                    .font(.headline)
                    .frame(width: 220, height: 52)
            }
            .buttonStyle(.borderedProminent)
            .tint(.yellow)
            .foregroundStyle(.black)
            .accessibilityLabel("Start a new game in \(store.lastDrawMode == "draw1" ? "Draw 1" : "Draw 3") mode")

            Spacer()
        }
        .padding(.horizontal, 32)
    }

    // MARK: - Resume card (DEV-345)

    private func resumeCard(_ session: ActiveSessionItem) -> some View {
        let timeLabel = String(format: "%d:%02d", session.timeSeconds / 60, session.timeSeconds % 60)
        return VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Game in Progress")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                    Text("\(session.moves) moves · \(timeLabel) · \(session.drawMode.uppercased())")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }
                Spacer()
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundStyle(.yellow)
            }

            Button {
                Task {
                    await store.resumeGame(item: session)
                    activeSession = nil
                }
            } label: {
                Label("Resume Game", systemImage: "play.fill")
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.yellow)
            .foregroundStyle(.black)
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.yellow.opacity(0.4)))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Game in progress: \(session.moves) moves. Resume it.")
    }

    // MARK: - Active session check (DEV-345)

    private func checkActiveSession() async {
        // DEV-252: /sessions/active returns { daily, random } — surface the random one.
        if let response: ActiveSessionsResponse = try? await APIClient.shared.get("/api/v1/sessions/active") {
            // Only offer resume when there's no local hand and the server session
            // isn't one we already have loaded.
            if store.state == nil, let random = response.random, random.uuid != store.sessionUuid {
                activeSession = random
            } else {
                activeSession = nil
            }
        }
    }

    // MARK: - Dealing spinner

    private var dealingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.4)
                .tint(.yellow)
            Text("Dealing cards…")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))
        }
    }

    // MARK: - Error banner

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.black)
            Text(message)
                .font(.footnote.bold())
                .foregroundStyle(.black)
                .lineLimit(2)
            Spacer()
            Button {
                store.errorMessage = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.footnote.bold())
                    .foregroundStyle(.black)
            }
            .accessibilityLabel("Dismiss error")
        }
        .padding(12)
        .background(Color.yellow)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .transition(.move(edge: .top).combined(with: .opacity))
        .animation(.spring(duration: 0.3), value: store.errorMessage)
    }

    // MARK: - Stats Bar

    private var statsBar: some View {
        HStack {
            Text(timerText)
                .font(.system(.body, design: .monospaced).bold())
                .foregroundStyle(.white)
                .accessibilityLabel("Elapsed time \(timerText)")

            Spacer()

            Text("\(store.state?.moveCount ?? 0) moves")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))
                .accessibilityLabel("\(store.state?.moveCount ?? 0) moves")

            Button { store.undo() } label: {
                Image(systemName: "arrow.uturn.backward").font(.title3)
            }
            .disabled(!store.canUndo)
            .padding(.leading, 8)
            .foregroundStyle(store.canUndo ? .white : .white.opacity(0.3))
            .accessibilityLabel("Undo last move")

            Button { showMenu = true } label: {
                Image(systemName: "ellipsis.circle").font(.title3)
            }
            .padding(.leading, 4)
            .foregroundStyle(.white)
            .accessibilityLabel("Game menu")
        }
    }

    // MARK: - Keyboard shortcuts (DEV-318)

    /// Hidden, shortcut-only buttons for hardware keyboards on iPad:
    /// U = undo · D = draw · N = new game. Present only while a game is live, so
    /// the keys don't fire on other screens. ⌘W (close modal) lives on the menu's
    /// Close button. All actions are safe no-ops when not applicable.
    private var keyboardShortcuts: some View {
        Group {
            Button { store.undo() } label: { Color.clear }
                .keyboardShortcut("u", modifiers: [])
            Button { store.draw(); Haptics.draw() } label: { Color.clear }
                .keyboardShortcut("d", modifiers: [])
            Button { Task { await store.newGame(drawMode: store.lastDrawMode) } } label: { Color.clear }
                .keyboardShortcut("n", modifiers: [])
        }
        .frame(width: 0, height: 0)
        .opacity(0)
        .accessibilityHidden(true)
    }

    // MARK: - Helpers

    private var timerText: String {
        String(format: "%02d:%02d", store.elapsedSeconds / 60, store.elapsedSeconds % 60)
    }

    private var winBinding: Binding<Bool> {
        Binding(get: { store.isWon }, set: { _ in })
    }
}

// MARK: - GameMenuView

private struct GameMenuView: View {
    let store: GameStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button {
                    Task { await store.newGame(drawMode: store.lastDrawMode) }
                    dismiss()
                } label: {
                    Label("New Game", systemImage: "play.fill")
                }

                Button {
                    store.undo()
                    dismiss()
                } label: {
                    Label("Undo", systemImage: "arrow.uturn.backward")
                }
                .disabled(!store.canUndo)

                Button {
                    Task { await store.redeal() }
                    dismiss()
                } label: {
                    Label("Redeal", systemImage: "arrow.clockwise")
                }

                Button(role: .destructive) {
                    Task { await store.abandonSession() }
                    dismiss()
                } label: {
                    Label("Abandon Game", systemImage: "xmark.circle")
                }

                // DEV-320: drag the hand seed out to Notes / Messages (iPad drag-and-drop)
                if let seed = store.state?.seed {
                    LabeledContent {
                        Text("\(seed)")
                            .font(.system(.body, design: .monospaced))
                            .foregroundStyle(.secondary)
                    } label: {
                        Label("Hand Seed", systemImage: "number")
                    }
                    .draggable("\(seed)")
                    .accessibilityHint("Drag to another app to share this hand's seed")
                }

                Button { dismiss() } label: {
                    Label("Close", systemImage: "xmark")
                }
                .keyboardShortcut("w", modifiers: .command)   // DEV-318: ⌘W closes the modal
            }
            .navigationTitle("Menu")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
