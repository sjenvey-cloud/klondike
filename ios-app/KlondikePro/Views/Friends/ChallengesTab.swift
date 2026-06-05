import SwiftUI

/// DEV-298 / DEV-299 / DEV-300 — Social challenge list, detail with leaderboard,
/// play, and creator end/resume controls.
struct ChallengesTab: View {

    @Environment(FriendsStore.self) private var store

    @State private var selectedChallenge: SocialChallenge?

    var body: some View {
        Group {
            if store.isLoadingChallenges && store.challenges.isEmpty {
                VStack { Spacer(); ProgressView().tint(.yellow); Spacer() }
            } else if store.challenges.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(store.challenges) { challenge in
                            Button { selectedChallenge = challenge } label: {
                                challengeCard(challenge)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .task {
            await store.fetchChallenges()
            store.markChallengesViewed()
        }
        .sheet(item: $selectedChallenge) { challenge in
            ChallengeDetailView(challenge: challenge)
                .environment(store)
        }
    }

    private func challengeCard(_ c: SocialChallenge) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(c.creatorDisplayName + "'s challenge")
                    .font(.subheadline.bold()).foregroundStyle(.white).lineLimit(1)
                Spacer()
                statusBadge(c)
            }
            HStack(spacing: 14) {
                stat(icon: "person.2.fill", value: "\(c.participantCount)", label: "players")
                stat(icon: "checkmark.seal.fill", value: "\(c.winnerCount)", label: "winners")
                Spacer()
                Text(c.drawMode == "draw1" ? "Draw 1" : "Draw 3")
                    .font(.caption).foregroundStyle(.white.opacity(0.5))
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(alignment: .topTrailing) {
            if c.userHasWon {
                Image(systemName: "crown.fill").foregroundStyle(.yellow).font(.caption).padding(8)
            }
        }
    }

    private func statusBadge(_ c: SocialChallenge) -> some View {
        let ended = c.status == "ended"
        return Text(ended ? "Ended" : "Active")
            .font(.caption2.bold())
            .foregroundStyle(ended ? .white.opacity(0.5) : .black)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(ended ? Color.white.opacity(0.1) : Color.green.opacity(0.8))
            .clipShape(Capsule())
    }

    private func stat(icon: String, value: String, label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.caption2).foregroundStyle(.yellow.opacity(0.7))
            Text(value).font(.caption.bold()).foregroundStyle(.white)
            Text(label).font(.caption2).foregroundStyle(.white.opacity(0.4))
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "flag.2.crossed")
                .font(.system(size: 44)).foregroundStyle(.white.opacity(0.2))
            Text("No challenges yet")
                .font(.subheadline).foregroundStyle(.white.opacity(0.4))
            Text("Win a game, then challenge your friends to beat it from the win screen.")
                .font(.caption).foregroundStyle(.white.opacity(0.3))
                .multilineTextAlignment(.center).padding(.horizontal, 32)
        }
    }
}

// MARK: - Challenge detail (DEV-298 / DEV-299 / DEV-300)

struct ChallengeDetailView: View {
    @Environment(FriendsStore.self) private var store
    @Environment(PreferencesStore.self) private var preferencesStore
    @Environment(\.dismiss) private var dismiss

    let challenge: SocialChallenge

    @State private var detail: SocialChallengeDetail?
    @State private var playStore: GameStore?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Play button (DEV-299) — active challenges only
                    if challenge.status == "active", let handUuid = challenge.handUuid {
                        Button {
                            let gs = GameStore(userId: store.userId)
                            playStore = gs
                            Task { await gs.startChallenge(handUuid: handUuid, drawMode: challenge.drawMode) }
                        } label: {
                            Label(challenge.userHasWon ? "Play Again" : "Play Challenge", systemImage: "play.fill")
                                .font(.subheadline.bold()).foregroundStyle(.black)
                                .frame(maxWidth: .infinity).padding(.vertical, 14)
                                .background(Color.yellow).clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }

                    // Leaderboard
                    Text("LEADERBOARD").font(.caption.bold()).foregroundStyle(.white.opacity(0.4))
                    if let d = detail {
                        if d.leaderboard.isEmpty {
                            Text("No winners yet — be the first!")
                                .font(.caption).foregroundStyle(.white.opacity(0.35))
                        } else {
                            ForEach(d.leaderboard) { entry in
                                leaderboardRow(entry)
                            }
                        }
                    } else {
                        ProgressView().tint(.yellow).frame(maxWidth: .infinity).padding(.vertical, 20)
                    }

                    // Creator controls (DEV-300)
                    if challenge.isCreator {
                        creatorControls
                    }
                }
                .padding(16)
            }
            .background(Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea())
            .navigationTitle(challenge.creatorDisplayName + "'s challenge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(.yellow)
                }
            }
            .task { detail = await store.challengeDetail(id: challenge.id) }
            .fullScreenCover(item: Binding(
                get: { playStore.map { GameStoreBox(store: $0) } },
                set: { playStore = $0?.store }
            )) { box in
                NavigationStack {
                    GameView(store: box.store)
                        .environment(preferencesStore)
                        .environment(\.feltColor, preferencesStore.feltColor)
                        .environment(\.cardBackColor, preferencesStore.cardBackColor)
                        .toolbar {
                            ToolbarItem(placement: .navigationBarLeading) {
                                Button("Close") {
                                    Task { await box.store.abandonSession() }
                                    playStore = nil
                                    Task {
                                        detail = await store.challengeDetail(id: challenge.id)
                                        await store.fetchChallenges()
                                    }
                                }.foregroundStyle(.yellow)
                            }
                        }
                }
            }
        }
    }

    private func leaderboardRow(_ entry: SocialLeaderboardEntry) -> some View {
        let isMe = entry.userId == store.userId
        return HStack(spacing: 12) {
            Text(entry.rank > 0 ? "#\(entry.rank)" : "—")
                .font(.system(.subheadline, design: .monospaced).bold())
                .foregroundStyle(.white.opacity(0.6)).frame(width: 34, alignment: .leading)
            Text(entry.displayName + (entry.isCreator ? " 👑" : ""))
                .font(.subheadline.weight(isMe ? .bold : .regular))
                .foregroundStyle(isMe ? Color.yellow : Color.white)
            Spacer()
            if let moves = entry.moves {
                Text("\(moves) moves").font(.caption).foregroundStyle(.white.opacity(0.6))
            } else {
                Text("not won").font(.caption).foregroundStyle(.white.opacity(0.3))
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(isMe ? Color.yellow.opacity(0.07) : Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var creatorControls: some View {
        VStack(spacing: 10) {
            if challenge.status == "active" {
                Button {
                    Task { await store.endChallenge(id: challenge.id); dismiss() }
                } label: {
                    Label("End Challenge", systemImage: "stop.circle")
                        .font(.subheadline.bold()).foregroundStyle(.orange)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(Color.white.opacity(0.05)).clipShape(RoundedRectangle(cornerRadius: 10))
                }
            } else {
                Button {
                    Task { await store.resumeChallenge(id: challenge.id); dismiss() }
                } label: {
                    Label("Resume Challenge", systemImage: "play.circle")
                        .font(.subheadline.bold()).foregroundStyle(.green)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(Color.white.opacity(0.05)).clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding(.top, 8)
    }
}

/// Identifiable wrapper so a GameStore can drive `.fullScreenCover(item:)`.
private struct GameStoreBox: Identifiable {
    let store: GameStore
    var id: ObjectIdentifier { ObjectIdentifier(store) }
}
