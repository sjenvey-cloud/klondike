import SwiftUI

// MARK: - LeaderboardView (DEV-303, DEV-304)

/// Global leaderboard: period / drawMode / sort filters, paginated list,
/// personal rank banner pinned at the bottom.
///
/// GET /api/v1/leaderboard/global — returns PagedResponse<GlobalLeaderboardEntry>.
/// GET /api/v1/leaderboard/global/{uuid}/rank — caller's rank.
struct LeaderboardView: View {

    @Environment(LeaderboardStore.self) private var store

    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                filterBar
                Divider().background(Color.white.opacity(0.1))
                leaderboardList
            }

            // Pinned my-rank banner (DEV-303)
            if let my = store.myEntry {
                myRankBanner(my)
            }
        }
        .background(Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea())
        .navigationTitle("Rankings")
        .task { await store.fetchLeaderboard() }
        .onChange(of: store.period)   { _, _ in Task { await store.fetchLeaderboard() } }
        .onChange(of: store.drawMode) { _, _ in Task { await store.fetchLeaderboard() } }
        .onChange(of: store.sort)     { _, _ in Task { await store.fetchLeaderboard() } }
    }

    // MARK: - Filter bar

    private var filterBar: some View {
        @Bindable var s = store
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Period
                filterGroup(
                    options: [("Weekly", "weekly"), ("Monthly", "monthly"), ("All Time", "all-time")],
                    selected: $s.period
                )

                Rectangle()
                    .fill(Color.white.opacity(0.12))
                    .frame(width: 1, height: 20)

                // Draw mode
                filterGroup(
                    options: [("Draw 1", "draw1"), ("Draw 3", "draw3")],
                    selected: $s.drawMode
                )

                Rectangle()
                    .fill(Color.white.opacity(0.12))
                    .frame(width: 1, height: 20)

                // Sort
                filterGroup(
                    options: [("Moves", "moves"), ("Time", "time")],
                    selected: $s.sort
                )
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    private func filterGroup(options: [(String, String)], selected: Binding<String>) -> some View {
        HStack(spacing: 6) {
            ForEach(options, id: \.1) { label, value in
                let active = selected.wrappedValue == value
                Button { selected.wrappedValue = value } label: {
                    Text(label)
                        .font(.caption.weight(active ? .bold : .regular))
                        .foregroundStyle(active ? .black : .white.opacity(0.65))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(active ? Color.yellow : Color.white.opacity(0.1))
                        .clipShape(Capsule())
                }
                .accessibilityLabel(label)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
    }

    // MARK: - Leaderboard list

    @ViewBuilder
    private var leaderboardList: some View {
        if store.isLoading {
            VStack { Spacer(); ProgressView().tint(.yellow); Spacer() }

        } else if store.entries.isEmpty {
            VStack(spacing: 16) {
                Spacer()
                Image(systemName: "trophy")
                    .font(.system(size: 48))
                    .foregroundStyle(.yellow.opacity(0.3))
                Text("No rankings yet")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.45))
                Text("Win a ranked game to appear on the leaderboard.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.3))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                Spacer()
            }

        } else {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(store.entries) { entry in
                        entryRow(entry)
                        Divider().background(Color.white.opacity(0.07))
                            .onAppear {
                                // DEV-304: trigger load-more when last item appears
                                if entry.id == store.entries.last?.id {
                                    Task { await store.loadMore() }
                                }
                            }
                    }

                    if store.isLoadingMore {
                        ProgressView()
                            .tint(.yellow)
                            .padding(20)
                    }
                }
                // Padding so list content isn't hidden behind the pinned my-rank banner
                .padding(.bottom, store.myEntry != nil ? 72 : 0)
            }
        }
    }

    // MARK: - Entry row

    private func entryRow(_ entry: GlobalLeaderboardEntry) -> some View {
        let isMe = entry.userUuid != nil && entry.userUuid == store.userUuid

        return HStack(spacing: 12) {
            // Rank
            Text("#\(entry.rank)")
                .font(.system(.subheadline, design: .monospaced).bold())
                .foregroundStyle(rankColor(entry.rank))
                .frame(width: 40, alignment: .leading)

            // Name
            Text(entry.displayName)
                .font(.subheadline.weight(isMe ? .bold : .regular))
                .foregroundStyle(isMe ? Color.yellow : Color.white)
                .lineLimit(1)

            Spacer()

            // Moves
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(entry.moves)")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                Text("moves")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
            }

            // Time
            VStack(alignment: .trailing, spacing: 2) {
                Text(formattedTime(entry.timeSeconds))
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.8))
                Text("time")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
            }
            .frame(width: 52, alignment: .trailing)

            // Connect — send a friend request to a player you're not already linked to
            if let uuid = entry.userUuid, !isMe {
                LeaderboardConnectButton(userUuid: uuid)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(isMe ? Color.yellow.opacity(0.07) : Color.clear)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Rank \(entry.rank): \(entry.displayName), \(entry.moves) moves, \(formattedTime(entry.timeSeconds))")
    }

    // MARK: - My rank banner (DEV-303)

    private func myRankBanner(_ entry: GlobalLeaderboardEntry) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "person.fill")
                .foregroundStyle(.yellow)
                .font(.subheadline)

            Text("Your rank:")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))

            Text("#\(entry.rank)")
                .font(.subheadline.bold())
                .foregroundStyle(.yellow)

            Spacer()

            Text("\(entry.moves) moves")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.6))

            Text(formattedTime(entry.timeSeconds))
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.white.opacity(0.6))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(Color(red: 0.05, green: 0.07, blue: 0.10).opacity(0.97))
        .overlay(alignment: .top) {
            Divider().background(Color.yellow.opacity(0.3))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Your rank: \(entry.rank). \(entry.moves) moves, \(formattedTime(entry.timeSeconds))")
    }

    // MARK: - Helpers

    private func formattedTime(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color(red: 1.0, green: 0.84, blue: 0.0)    // gold
        case 2: return Color(red: 0.75, green: 0.75, blue: 0.75)  // silver
        case 3: return Color(red: 0.80, green: 0.50, blue: 0.20)  // bronze
        default: return Color.white.opacity(0.5)
        }
    }
}

// MARK: - Connect button (leaderboards)

/// A tap-to-connect button shown on leaderboard rows for players the user isn't
/// themselves. Sends a connect request by the player's public UUID and flips to a
/// checkmark once sent (the backend is idempotent for already-friends/requested).
struct LeaderboardConnectButton: View {
    let userUuid: UUID
    @Environment(FriendsStore.self) private var friends
    @State private var sending = false

    var body: some View {
        let sent = friends.hasSentConnect(to: userUuid)
        Button {
            guard !sent, !sending else { return }
            sending = true
            Task {
                await friends.sendConnectRequest(toUserUuid: userUuid)
                sending = false
            }
        } label: {
            Group {
                if sending {
                    ProgressView().tint(.yellow)
                } else {
                    Image(systemName: sent ? "checkmark.circle.fill" : "person.crop.circle.badge.plus")
                        .font(.subheadline)
                        .foregroundStyle(sent ? Color.green : Color.yellow)
                }
            }
            .frame(width: 28)
        }
        .buttonStyle(.plain)
        .disabled(sent || sending)
        .accessibilityLabel(sent ? "Connect request sent" : "Connect")
    }
}
