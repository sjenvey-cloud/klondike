import SwiftUI

/// Shown when the player wins a game.
/// Submits the session to the server on appear, offers new game or dismissal.
struct WinView: View {

    let store: GameStore
    let drawMode: String
    var onNewGame: () -> Void
    /// Only the main random Game tab can spawn a social challenge from a win
    /// (challenge/daily contexts don't, and have no FriendsStore in scope).
    var canChallenge: Bool = false
    @Environment(\.dismiss) private var dismiss
    @Environment(PreferencesStore.self) private var prefs

    @State private var showReplay    = false
    @State private var showChallenge = false
    @State private var challengeSent = false

    /// DEV-291: only show confetti when the win-animation preference is "confetti".
    private var showConfetti: Bool { prefs.preferences.winAnimation == "confetti" }

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

                // Challenge Friends (web parity) — random games only.
                if canChallenge, store.sessionUuid != nil {
                    if challengeSent {
                        Label("Challenge sent!", systemImage: "checkmark.circle.fill")
                            .font(.subheadline.bold())
                            .foregroundStyle(.green)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .padding(.horizontal)
                    } else {
                        Button {
                            showChallenge = true
                        } label: {
                            Label("Challenge Friends", systemImage: "person.2.fill")
                                .font(.subheadline)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                        }
                        .buttonStyle(.bordered)
                        .tint(.yellow)
                        .foregroundStyle(.yellow)
                        .padding(.horizontal)
                        .accessibilityLabel("Challenge friends to beat this hand")
                    }
                }

                Button {
                    // DEV: end the finished game so the win sheet dismisses (its
                    // binding follows isWon) — a plain dismiss() re-presented because
                    // the won state was still true.
                    store.clearBoard()
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
        .sheet(isPresented: $showChallenge) {
            if let uuid = store.sessionUuid {
                ChallengeComposeSheet(sessionUuid: uuid) { challengeSent = true }
            }
        }
        .overlay {
            if showConfetti {
                ConfettiLayer()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }
        }
        .task {
            Haptics.win()   // DEV-340: celebratory success haptic
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
