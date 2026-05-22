import SwiftUI

/// Top-level game view: stats bar + board + win/menu sheets.
struct GameView: View {

    let store: GameStore
    @State private var showMenu = false

    var body: some View {
        ZStack {
            Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

            if store.isLoading {
                // ── Dealing in progress ──────────────────────────────────
                dealingView

            } else if store.state != nil {
                // ── Live game board ──────────────────────────────────────
                NavigationStack {
                    VStack(spacing: 0) {
                        statsBar
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)

                        GeometryReader { proxy in
                            let totalSpacing: CGFloat = 16 * 2 + 6 * 2
                            let cardWidth = (proxy.size.width - totalSpacing) / 7
                            BoardView(store: store, cardWidth: max(36, cardWidth))
                        }
                    }
                    .background(Color(red: 0.05, green: 0.07, blue: 0.10))
                    .navigationTitle("")
                    .navigationBarHidden(true)
                }
                .sheet(isPresented: winBinding) {
                    WinView(
                        store: store,
                        drawMode: store.state?.drawMode ?? store.lastDrawMode,
                        onNewGame: {}
                    )
                }
                .sheet(isPresented: $showMenu) {
                    GameMenuView(store: store)
                }

            } else {
                // ── No game in progress ──────────────────────────────────
                noGameView
            }

            // ── Error banner (floats above everything) ───────────────────
            if let msg = store.errorMessage {
                VStack {
                    errorBanner(msg)
                    Spacer()
                }
            }
        }
    }

    // MARK: - No-game empty state

    private var noGameView: some View {
        VStack(spacing: 32) {
            Spacer()

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

                Button(role: .destructive) {
                    Task { await store.abandonSession() }
                    dismiss()
                } label: {
                    Label("Abandon Game", systemImage: "xmark.circle")
                }

                Button { dismiss() } label: {
                    Label("Close", systemImage: "xmark")
                }
            }
            .navigationTitle("Menu")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
