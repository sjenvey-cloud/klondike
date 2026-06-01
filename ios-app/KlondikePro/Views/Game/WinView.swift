import SwiftUI

/// Shown when the player wins a game.
/// Submits the session to the server on appear, offers new game or dismissal.
struct WinView: View {

    let store: GameStore
    let drawMode: String
    var onNewGame: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var showReplay = false

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // Win header
            VStack(spacing: 12) {
                Text("You Won!")
                    .font(.largeTitle.bold())
                    .accessibilityAddTraits(.isHeader)

                Text("Congratulations!")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            // Stats
            VStack(spacing: 8) {
                statRow(label: "Moves", value: "\(store.state?.moveCount ?? 0)")
                statRow(label: "Time",  value: formattedTime)
            }
            .padding()
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
            .padding(.horizontal)

            // Actions
            VStack(spacing: 12) {
                Button {
                    Task { await store.newGame(drawMode: drawMode) }
                    dismiss()
                } label: {
                    Label("New Game", systemImage: "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                }
                .buttonStyle(.borderedProminent)
                .tint(.yellow)
                .foregroundStyle(.black)
                .padding(.horizontal)
                .accessibilityLabel("Start a new game")

                // Watch Replay (DEV-307)
                if let uuid = store.sessionUuid {
                    Button {
                        showReplay = true
                    } label: {
                        Label("Watch Replay", systemImage: "play.rectangle.fill")
                            .font(.subheadline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(.yellow)
                    .foregroundStyle(.yellow)
                    .padding(.horizontal)
                    .accessibilityLabel("Watch session replay")
                    .sheet(isPresented: $showReplay) {
                        ReplayView(sessionUuid: uuid)
                    }
                }

                Button {
                    dismiss()
                } label: {
                    Text("Done")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.bordered)
                .padding(.horizontal)
                .accessibilityLabel("Close this screen")
            }

            Spacer()
        }
        .task {
            await store.completeSession()
        }
    }

    // MARK: - Helpers

    private var formattedTime: String {
        let m = store.elapsedSeconds / 60
        let s = store.elapsedSeconds % 60
        return String(format: "%02d:%02d", m, s)
    }

    private func statRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .bold()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}
