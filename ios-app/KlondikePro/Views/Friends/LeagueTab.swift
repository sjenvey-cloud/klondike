import SwiftUI

/// DEV-296 / DEV-297 — Friend league table + custom leagues, with a link to the
/// global rankings (the shipped LeaderboardView).
struct LeagueTab: View {

    @Environment(FriendsStore.self) private var store

    @State private var showCreateLeague = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                periodPicker
                friendLeagueSection
                globalRankingsLink
                customLeaguesSection
            }
            .padding(16)
        }
        .task {
            await store.fetchLeague()
            await store.fetchCustomLeagues()
        }
        .sheet(isPresented: $showCreateLeague) {
            CreateLeagueSheet()
                .environment(store)
        }
    }

    // MARK: - Period picker (DEV-296)

    private var periodPicker: some View {
        HStack(spacing: 8) {
            ForEach([("Week", "weekly"), ("Month", "monthly"), ("All Time", "alltime")], id: \.1) { label, value in
                let active = store.leaguePeriod == value
                Button {
                    store.leaguePeriod = value
                    Task { await store.fetchLeague() }
                } label: {
                    Text(label)
                        .font(.caption.weight(active ? .bold : .regular))
                        .foregroundStyle(active ? .black : .white.opacity(0.7))
                        .padding(.horizontal, 14).padding(.vertical, 7)
                        .background(active ? Color.yellow : Color.white.opacity(0.1))
                        .clipShape(Capsule())
                }
                .accessibilityAddTraits(active ? .isSelected : [])
            }
            Spacer()
        }
    }

    // MARK: - Friend league (DEV-296)

    @ViewBuilder
    private var friendLeagueSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("FRIEND LEAGUE")
                .font(.caption.bold()).foregroundStyle(.white.opacity(0.4))

            if store.isLoadingLeague && store.leagueEntries.isEmpty {
                ProgressView().tint(.yellow).frame(maxWidth: .infinity).padding(.vertical, 20)
            } else if store.leagueEntries.isEmpty {
                Text("No ranked wins in this period yet.")
                    .font(.caption).foregroundStyle(.white.opacity(0.35))
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
            } else {
                ForEach(store.leagueEntries) { entry in
                    leagueRow(entry)
                }
            }
        }
    }

    private func leagueRow(_ entry: LeagueEntry) -> some View {
        let isMe = entry.userId == store.userId
        return HStack(spacing: 12) {
            Text("#\(entry.rank)")
                .font(.system(.subheadline, design: .monospaced).bold())
                .foregroundStyle(rankColor(entry.rank))
                .frame(width: 36, alignment: .leading)
            Text(entry.displayName)
                .font(.subheadline.weight(isMe ? .bold : .regular))
                .foregroundStyle(isMe ? Color.yellow : Color.white)
                .lineLimit(1)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(entry.wins)")
                    .font(.subheadline.bold()).foregroundStyle(.white)
                Text("wins").font(.caption2).foregroundStyle(.white.opacity(0.4))
            }
            if let best = entry.bestMoves {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(best)").font(.system(.caption, design: .monospaced)).foregroundStyle(.white.opacity(0.8))
                    Text("best").font(.caption2).foregroundStyle(.white.opacity(0.4))
                }
                .frame(width: 44, alignment: .trailing)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(isMe ? Color.yellow.opacity(0.07) : Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Global rankings link

    private var globalRankingsLink: some View {
        NavigationLink {
            LeaderboardView()
        } label: {
            HStack {
                Image(systemName: "globe").foregroundStyle(.yellow)
                Text("Global Rankings")
                    .font(.subheadline.bold()).foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.3))
            }
            .padding(14)
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Custom leagues (DEV-297)

    private var customLeaguesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("MY LEAGUES")
                    .font(.caption.bold()).foregroundStyle(.white.opacity(0.4))
                Spacer()
                Button { showCreateLeague = true } label: {
                    Label("New", systemImage: "plus.circle.fill")
                        .font(.caption.bold()).foregroundStyle(.yellow)
                }
            }

            if store.customLeagues.isEmpty {
                Text("Create a league to compete with a custom group of friends.")
                    .font(.caption).foregroundStyle(.white.opacity(0.35))
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
            } else {
                ForEach(store.customLeagues) { league in
                    NavigationLink {
                        CustomLeagueDetailView(leagueId: league.id, leagueName: league.name)
                            .environment(store)
                    } label: {
                        customLeagueRow(league)
                    }
                }
            }
        }
    }

    private func customLeagueRow(_ league: CustomLeagueListEntry) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(Color.yellow.opacity(0.15)).frame(width: 38, height: 38)
                Image(systemName: "trophy.fill").foregroundStyle(.yellow).font(.subheadline)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(league.name).font(.subheadline.bold()).foregroundStyle(.white).lineLimit(1)
                Text("\(league.memberCount) member\(league.memberCount == 1 ? "" : "s")\(league.isCreator ? " · You own this" : "")")
                    .font(.caption).foregroundStyle(.white.opacity(0.45))
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.3))
        }
        .padding(12)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return Color(red: 1.0, green: 0.84, blue: 0.0)
        case 2: return Color(red: 0.75, green: 0.75, blue: 0.75)
        case 3: return Color(red: 0.80, green: 0.50, blue: 0.20)
        default: return Color.white.opacity(0.5)
        }
    }
}

// MARK: - Create league sheet (DEV-297)

struct CreateLeagueSheet: View {
    @Environment(FriendsStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var selectedMemberIds: Set<Int> = []

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("League Name").font(.caption.bold()).foregroundStyle(.white.opacity(0.5))
                        TextField("e.g. Sunday Solitaire Club", text: $name)
                            .padding(12)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(.white)

                        Text("Add Friends").font(.caption.bold()).foregroundStyle(.white.opacity(0.5))
                        if store.friends.isEmpty {
                            Text("Add friends first to invite them to a league.")
                                .font(.caption).foregroundStyle(.white.opacity(0.35))
                        } else {
                            ForEach(store.friends) { friend in
                                Button {
                                    if selectedMemberIds.contains(friend.userId) {
                                        selectedMemberIds.remove(friend.userId)
                                    } else {
                                        selectedMemberIds.insert(friend.userId)
                                    }
                                } label: {
                                    HStack {
                                        Image(systemName: selectedMemberIds.contains(friend.userId) ? "checkmark.circle.fill" : "circle")
                                            .foregroundStyle(selectedMemberIds.contains(friend.userId) ? .yellow : .white.opacity(0.3))
                                        Text(friend.displayName).foregroundStyle(.white)
                                        Spacer()
                                    }
                                    .padding(10)
                                    .background(Color.white.opacity(0.04))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("New League")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(.white.opacity(0.6))
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        Task {
                            await store.createCustomLeague(name: name, memberIds: Array(selectedMemberIds))
                            dismiss()
                        }
                    }
                    .foregroundStyle(name.trimmingCharacters(in: .whitespaces).isEmpty ? .white.opacity(0.3) : .yellow)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - Custom league detail (DEV-297)

struct CustomLeagueDetailView: View {
    @Environment(FriendsStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let leagueId: Int
    let leagueName: String

    @State private var detail: CustomLeagueDetail?
    @State private var leaderboard: [LeagueEntry] = []
    @State private var period = "week"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Leaderboard
                Text("LEADERBOARD").font(.caption.bold()).foregroundStyle(.white.opacity(0.4))
                if leaderboard.isEmpty {
                    Text("No ranked wins yet.").font(.caption).foregroundStyle(.white.opacity(0.35))
                } else {
                    ForEach(leaderboard) { entry in
                        HStack {
                            Text("#\(entry.rank)").font(.system(.subheadline, design: .monospaced).bold())
                                .foregroundStyle(.white.opacity(0.6)).frame(width: 34, alignment: .leading)
                            Text(entry.displayName)
                                .foregroundStyle(entry.userId == store.userId ? .yellow : .white)
                            Spacer()
                            Text("\(entry.wins) wins").font(.caption).foregroundStyle(.white.opacity(0.6))
                        }
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .background(Color.white.opacity(0.04)).clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }

                // Members
                if let d = detail {
                    Text("MEMBERS").font(.caption.bold()).foregroundStyle(.white.opacity(0.4))
                    ForEach(d.members) { m in
                        HStack {
                            Text(m.displayName).foregroundStyle(.white)
                            if !m.isFriend && m.userId != store.userId {
                                Button("Add") {
                                    Task { await store.sendFriendRequest(targetUserId: m.userId) }
                                }
                                .font(.caption.bold()).foregroundStyle(.yellow)
                            }
                            Spacer()
                            if d.isCreator && m.userId != store.userId {
                                Button {
                                    Task {
                                        await store.removeLeagueMember(leagueId: leagueId, userId: m.userId)
                                        await load()
                                    }
                                } label: { Image(systemName: "minus.circle").foregroundStyle(.white.opacity(0.3)) }
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .background(Color.white.opacity(0.04)).clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    if d.isCreator {
                        Button(role: .destructive) {
                            Task {
                                await store.deleteCustomLeague(id: leagueId)
                                dismiss()
                            }
                        } label: {
                            Label("Delete League", systemImage: "trash")
                                .font(.subheadline.bold()).foregroundStyle(.red)
                                .frame(maxWidth: .infinity).padding(.vertical, 14)
                                .background(Color.white.opacity(0.04)).clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .padding(.top, 8)
                    }
                }
            }
            .padding(16)
        }
        .background(Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea())
        .navigationTitle(leagueName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        detail = await store.leagueDetail(id: leagueId)
        leaderboard = await store.leagueLeaderboard(id: leagueId, period: period)
    }
}
