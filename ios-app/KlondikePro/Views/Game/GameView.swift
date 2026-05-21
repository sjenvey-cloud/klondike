import SwiftUI

/// Top-level game view: stats bar + board + win/menu sheets.
struct GameView: View {

    let store: GameStore
    @State private var showMenu = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                statsBar
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)

                GeometryReader { proxy in
                    // Fit 7 columns + spacing into available width
                    let totalSpacing: CGFloat = 16 * 2 + 6 * 2  // h-padding + inter-column
                    let cardWidth = (proxy.size.width - totalSpacing) / 7

                    BoardView(store: store, cardWidth: max(36, cardWidth))
                }
            }
            .background(Color(red: 0.05, green: 0.07, blue: 0.10))
            .navigationTitle("")
            .navigationBarHidden(true)
        }
        .sheet(isPresented: showWinBinding) {
            WinView(
                store: store,
                drawMode: store.state?.drawMode ?? "draw3",
                onNewGame: {}
            )
        }
        .sheet(isPresented: $showMenu) {
            GameMenuView(store: store)
        }
    }

    // MARK: - Stats Bar

    private var statsBar: some View {
        HStack {
            // Timer
            Text(timerText)
                .font(.system(.body, design: .monospaced).bold())
                .foregroundStyle(.primary)
                .accessibilityLabel("Elapsed time \(timerText)")

            Spacer()

            // Move count
            Text("\(store.state?.moveCount ?? 0) moves")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .accessibilityLabel("\(store.state?.moveCount ?? 0) moves")

            // Undo button
            Button {
                store.undo()
            } label: {
                Image(systemName: "arrow.uturn.backward")
                    .font(.title3)
            }
            .disabled(!store.canUndo)
            .padding(.leading, 8)
            .accessibilityLabel("Undo last move")

            // Menu button
            Button {
                showMenu = true
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
            }
            .padding(.leading, 4)
            .accessibilityLabel("Game menu")
        }
        .foregroundStyle(Color.white)
    }

    // MARK: - Computed properties

    private var timerText: String {
        let m = store.elapsedSeconds / 60
        let s = store.elapsedSeconds % 60
        return String(format: "%02d:%02d", m, s)
    }

    private var showWinBinding: Binding<Bool> {
        Binding(
            get: { store.isWon },
            set: { _ in }   // sheet is dismissed by user actions inside WinView
        )
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
                    Task {
                        await store.newGame(drawMode: store.state?.drawMode ?? "draw3")
                    }
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
                    Task {
                        await store.abandonSession()
                    }
                    dismiss()
                } label: {
                    Label("Abandon Game", systemImage: "xmark.circle")
                }

                Button {
                    dismiss()
                } label: {
                    Label("Close", systemImage: "xmark")
                }
            }
            .navigationTitle("Menu")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
