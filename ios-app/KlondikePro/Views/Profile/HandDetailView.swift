import SwiftUI

/// Per-hand actions opened from the profile day-detail. Available for every played
/// hand, won or lost: play the hand, watch the replay, challenge friends, and view
/// the hand's all-time leaderboard — matching the web.
struct HandDetailView: View {

    let session: ProfileDaySession

    @Environment(AuthStore.self)        private var authStore
    @Environment(PreferencesStore.self) private var prefs

    @State private var showReplay    = false
    @State private var showChallenge = false
    @State private var challengeSent = false
    @State private var playStore: GameStore?

    private var timeLabel: String {
        String(format: "%d:%02d", session.timeSeconds / 60, session.timeSeconds % 60)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Result + stats
                VStack(spacing: 10) {
                    Image(systemName: session.isWon ? "checkmark.seal.fill" : "xmark.seal")
                        .font(.system(size: 44))
                        .foregroundStyle(session.isWon ? .yellow : .white.opacity(0.3))
                    Text(session.isWon ? "Won" : "Did not finish")
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                    HStack(spacing: 16) {
                        stat("\(session.moves)", "moves")
                        stat(timeLabel, "time")
                        stat(session.drawMode == "draw1" ? "Draw 1" : "Draw 3", "mode")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)

                // Actions
                VStack(spacing: 12) {
                    if session.handUuid != nil {
                        actionButton("Play This Hand", icon: "play.fill", prominent: true) {
                            startPlay()
                        }
                    }
                    actionButton("Watch Replay", icon: "play.rectangle.fill") {
                        showReplay = true
                    }
                    if challengeSent {
                        Label("Challenge sent!", systemImage: "checkmark.circle.fill")
                            .font(.subheadline.bold()).foregroundStyle(.green)
                            .frame(maxWidth: .infinity).frame(height: 50)
                    } else {
                        actionButton("Challenge Friends", icon: "person.2.fill") {
                            showChallenge = true
                        }
                    }
                    if let handUuid = session.handUuid {
                        NavigationLink {
                            HandLeaderboardView(handUuid: handUuid)
                        } label: {
                            actionLabel("Leaderboard", icon: "list.number")
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .background(Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea())
        .navigationTitle("Hand")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showReplay) {
            ReplayView(sessionUuid: session.uuid)
        }
        .sheet(isPresented: $showChallenge) {
            ChallengeComposeSheet(sessionUuid: session.uuid) { challengeSent = true }
        }
        .fullScreenCover(item: Binding(
            get: { playStore.map { GameStoreBox(store: $0) } },
            set: { playStore = $0?.store }
        )) { box in
            NavigationStack {
                GameView(store: box.store)
                    .environment(prefs)
                    .environment(\.feltColor,     prefs.feltColor)
                    .environment(\.cardBackColor, prefs.cardBackColor)
                    .environment(\.cardStyle,     prefs.preferences.cardStyle)
                    .toolbar {
                        ToolbarItem(placement: .navigationBarLeading) {
                            Button("Close") {
                                Task { await box.store.abandonSession() }
                                playStore = nil
                            }.foregroundStyle(.yellow)
                        }
                    }
            }
        }
    }

    private func startPlay() {
        guard let handUuid = session.handUuid else { return }
        let gs = GameStore(userId: authStore.userId ?? 0)
        playStore = gs
        Task { await gs.startChallenge(handUuid: handUuid, drawMode: session.drawMode) }
    }

    // MARK: - Bits

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.subheadline.bold()).foregroundStyle(.white)
            Text(label).font(.caption2).foregroundStyle(.white.opacity(0.4))
        }
    }

    private func actionButton(_ title: String, icon: String, prominent: Bool = false,
                              action: @escaping () -> Void) -> some View {
        Button(action: action) { actionLabel(title, icon: icon) }
            .buttonStyle(.borderedProminent)
            .tint(prominent ? .yellow : Color.white.opacity(0.08))
            .foregroundStyle(prominent ? .black : .yellow)
    }

    private func actionLabel(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.headline)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
    }
}

/// Identifiable wrapper so a GameStore can drive `.fullScreenCover(item:)`.
private struct GameStoreBox: Identifiable {
    let store: GameStore
    var id: ObjectIdentifier { ObjectIdentifier(store) }
}

// MARK: - Hand leaderboard

/// All-time leaderboard for a specific deal — GET /api/v1/hands/{uuid}/leaderboard.
struct HandLeaderboardView: View {

    let handUuid: UUID

    @Environment(AuthStore.self) private var authStore
    @State private var entries: [GlobalLeaderboardEntry] = []
    @State private var loading = true

    var body: some View {
        ZStack {
            Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

            if loading {
                ProgressView().tint(.yellow).scaleEffect(1.2)
            } else if entries.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "list.number")
                        .font(.system(size: 40)).foregroundStyle(.white.opacity(0.2))
                    Text("No winners yet")
                        .font(.subheadline).foregroundStyle(.white.opacity(0.5))
                    Text("Be the first to win this hand.")
                        .font(.caption).foregroundStyle(.white.opacity(0.35))
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(entries) { entry in
                            row(entry)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .navigationTitle("Hand Leaderboard")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            entries = (try? await APIClient.shared.get("/api/v1/hands/\(handUuid)/leaderboard")) ?? []
            loading = false
        }
    }

    private func row(_ entry: GlobalLeaderboardEntry) -> some View {
        let isMe = entry.userUuid != nil && entry.userUuid == authStore.user?.uuid
        return HStack(spacing: 12) {
            Text("#\(entry.rank)")
                .font(.system(.subheadline, design: .monospaced).bold())
                .foregroundStyle(.white.opacity(0.6))
                .frame(width: 40, alignment: .leading)
            Text(entry.displayName)
                .font(.subheadline.weight(isMe ? .bold : .regular))
                .foregroundStyle(isMe ? Color.yellow : Color.white)
            Spacer()
            Text("\(entry.moves) moves")
                .font(.caption).foregroundStyle(.white.opacity(0.6))
            Text(String(format: "%d:%02d", entry.timeSeconds / 60, entry.timeSeconds % 60))
                .font(.system(.caption, design: .monospaced)).foregroundStyle(.white.opacity(0.45))
            if let uuid = entry.userUuid, !isMe {
                LeaderboardConnectButton(userUuid: uuid)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(isMe ? Color.yellow.opacity(0.08) : Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
