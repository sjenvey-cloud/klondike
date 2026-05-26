import SwiftUI

/// DEV-274 — Daily leaderboard sorted by moves or time.
/// Personal rank is pinned in a banner at the top when the user has a result.
struct DailyLeaderboardView: View {

    @Environment(DailyStore.self) private var store

    var body: some View {
        VStack(spacing: 0) {
            // ── Personal rank banner ─────────────────────────────────────
            if let my = store.myRank {
                myRankBanner(my)
            }

            // ── Sort toggle ───────────────────────────────────────────────
            sortPicker
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

            Divider().background(Color.white.opacity(0.1))

            // ── Leaderboard table ─────────────────────────────────────────
            if store.isLoadingLeaderboard {
                Spacer()
                ProgressView()
                    .tint(.yellow)
                Spacer()

            } else if store.leaderboard.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "trophy")
                        .font(.system(size: 40))
                        .foregroundStyle(.yellow.opacity(0.4))
                    Text("No entries yet — be the first!")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.5))
                }
                Spacer()

            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(store.leaderboard) { entry in
                            leaderboardRow(entry)
                            Divider().background(Color.white.opacity(0.07))
                        }
                    }
                }
            }
        }
        .task { await loadLeaderboard() }
        .onChange(of: store.leaderboardSort) { _, _ in
            Task { await loadLeaderboard() }
        }
        .onChange(of: store.dailyDate) { _, newDate in
            guard !newDate.isEmpty else { return }
            Task { await loadLeaderboard() }
        }
    }

    // MARK: - Personal rank banner

    private func myRankBanner(_ entry: DailyLeaderboardEntry) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "person.fill")
                .foregroundStyle(.yellow)

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
                .font(.caption)
                .foregroundStyle(.white.opacity(0.6))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.yellow.opacity(0.12))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Your rank: \(entry.rank). \(entry.moves) moves in \(formattedTime(entry.timeSeconds))")
    }

    // MARK: - Sort picker

    @ViewBuilder
    private var sortPicker: some View {
        @Bindable var bindableStore = store
        HStack(spacing: 8) {
            Text("Sort by:")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.5))

            ForEach(LeaderboardSort.allCases, id: \.self) { sort in
                let active = store.leaderboardSort == sort
                Button {
                    store.leaderboardSort = sort
                } label: {
                    Text(sort.label)
                        .font(.caption.weight(active ? .bold : .regular))
                        .foregroundStyle(active ? .black : .white.opacity(0.7))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(active ? Color.yellow : Color.white.opacity(0.1))
                        .clipShape(Capsule())
                }
                .accessibilityLabel("Sort by \(sort.label)")
                .accessibilityAddTraits(active ? [.isSelected] : [])
            }

            Spacer()
        }
    }

    // MARK: - Leaderboard row

    private func leaderboardRow(_ entry: DailyLeaderboardEntry) -> some View {
        let isMe = entry.userUuid != nil && entry.userUuid == myUserUuid

        return HStack(spacing: 12) {
            // Rank
            Text("#\(entry.rank)")
                .font(.system(.subheadline, design: .monospaced).bold())
                .foregroundStyle(rankColor(entry.rank))
                .frame(width: 36, alignment: .leading)

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
                    .font(.system(.subheadline, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.8))
                Text("time")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
            }
            .frame(width: 54, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
        .background(isMe ? Color.yellow.opacity(0.07) : Color.clear)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Rank \(entry.rank): \(entry.displayName), \(entry.moves) moves, \(formattedTime(entry.timeSeconds))")
    }

    // MARK: - Helpers

    private var myUserUuid: UUID? {
        // The store doesn't hold userUuid directly — compare by checking myRank
        store.myRank?.userUuid
    }

    private func loadLeaderboard() async {
        let date = store.dailyDate.isEmpty ? todayString() : store.dailyDate
        await store.fetchLeaderboard(for: date)
    }

    private func formattedTime(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color(red: 1.0, green: 0.84, blue: 0.0)   // gold
        case 2: return Color(red: 0.75, green: 0.75, blue: 0.75) // silver
        case 3: return Color(red: 0.80, green: 0.50, blue: 0.20) // bronze
        default: return Color.white.opacity(0.5)
        }
    }

    private func todayString() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}
