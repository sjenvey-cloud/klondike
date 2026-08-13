import SwiftUI

/// DEV-294 / DEV-295 / DEV-334 — Friends list, requests, invite, and Game Center import.
struct FriendsTab: View {

    @Environment(FriendsStore.self) private var store

    @State private var inviteURL: String?
    @State private var showInviteShare = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                actionRow

                if let msg = store.gcImportMessage {
                    importBanner(msg)
                }

                // Accepted connect acknowledgments — "you're now connected"
                if !store.acceptedRequests.isEmpty {
                    acceptedSection
                }

                // Incoming connect requests (DEV-295)
                if !store.receivedRequests.isEmpty {
                    requestsSection
                }

                // Friend list (DEV-294)
                friendsSection
            }
            .padding(16)
        }
        .task {
            await store.fetchFriends()
            await store.fetchReceivedRequests()
        }
        .sheet(isPresented: $showInviteShare) {
            if let url = inviteURL {
                ShareSheet(items: [url])
            }
        }
    }

    // MARK: - Action row (invite + GC import)

    private var actionRow: some View {
        HStack(spacing: 10) {
            Button {
                Task {
                    if let invite = await store.createInvite() {
                        inviteURL = invite.inviteUrl
                        showInviteShare = true
                    }
                }
            } label: {
                Label("Invite", systemImage: "square.and.arrow.up")
                    .font(.subheadline.bold())
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.yellow)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            Button {
                Task { await importFromGameCenter() }
            } label: {
                HStack(spacing: 6) {
                    if store.isImportingGameCenter {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "gamecontroller.fill")
                    }
                    Text("Game Center")
                }
                .font(.subheadline.bold())
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.white.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(store.isImportingGameCenter)
        }
    }

    private func importBanner(_ msg: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "person.2.fill").foregroundStyle(.yellow)
            Text(msg)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.8))
            Spacer()
        }
        .padding(12)
        .background(Color.yellow.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func importFromGameCenter() async {
        do {
            let ids = try await GameCenterService.shared.loadFriendTeamPlayerIDs()
            await store.importGameCenterFriends(playerIds: ids)
            await store.fetchFriends()
        } catch {
            // Surfaced via the store's message on failure paths; set a friendly note here too.
            store.gcImportMessage = "Game Center friends aren't available. Check Game Center is signed in and friend sharing is allowed."
        }
    }

    // MARK: - Connect requests section (DEV-295)

    private var requestsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Connect Requests", count: store.receivedRequests.count)
            ForEach(store.receivedRequests) { req in
                HStack(spacing: 12) {
                    avatarCircle(name: req.requesterDisplayName)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(req.requesterDisplayName)
                            .font(.subheadline.bold())
                            .foregroundStyle(.white)
                        Text(requestSubtitle(req))
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.45))
                    }
                    Spacer()
                    Button {
                        Task { await store.acceptRequest(req) }
                    } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title3).foregroundStyle(.green)
                    }
                    .accessibilityLabel("Accept \(req.requesterDisplayName)")
                    Button {
                        Task { await store.declineRequest(req) }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title3).foregroundStyle(.white.opacity(0.3))
                    }
                    .accessibilityLabel("Decline \(req.requesterDisplayName)")
                }
                .padding(12)
                .background(Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    /// "United States · 42 games" — omits the location when unknown.
    private func requestSubtitle(_ req: FriendRequestEntry) -> String {
        let games = "\(req.requesterGamesPlayed) game\(req.requesterGamesPlayed == 1 ? "" : "s")"
        if let loc = req.requesterLocation, !loc.isEmpty {
            return "\(loc) · \(games)"
        }
        return games
    }

    // MARK: - Accepted acknowledgments

    private var acceptedSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Now Connected", count: store.acceptedRequests.count)
            ForEach(store.acceptedRequests) { acc in
                HStack(spacing: 12) {
                    avatarCircle(name: acc.acceptorDisplayName)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(acc.acceptorDisplayName)
                            .font(.subheadline.bold())
                            .foregroundStyle(.white)
                        Text(acc.acceptorLocation.map { "\($0) · accepted your request" }
                             ?? "accepted your request")
                            .font(.caption)
                            .foregroundStyle(.green.opacity(0.8))
                    }
                    Spacer()
                    Button {
                        store.dismissAccepted(acc)
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption.bold())
                            .foregroundStyle(.white.opacity(0.4))
                    }
                    .accessibilityLabel("Dismiss")
                }
                .padding(12)
                .background(Color.green.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    // MARK: - Friends section (DEV-294)

    @ViewBuilder
    private var friendsSection: some View {
        if store.isLoadingFriends && store.friends.isEmpty {
            ProgressView().tint(.yellow).padding(.top, 40)
        } else if store.friends.isEmpty {
            emptyState
        } else {
            VStack(alignment: .leading, spacing: 8) {
                sectionHeader("Friends", count: store.friends.count)
                ForEach(store.friends) { friend in
                    friendRow(friend)
                }
            }
        }
    }

    private func friendRow(_ friend: Friend) -> some View {
        HStack(spacing: 12) {
            avatarCircle(name: friend.displayName, url: friend.avatarUrl)
            VStack(alignment: .leading, spacing: 2) {
                Text(friend.displayName)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                Text(friend.gamesCompletedToday > 0
                     ? "\(friend.gamesCompletedToday) win\(friend.gamesCompletedToday == 1 ? "" : "s") today"
                     : "No games today")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.45))
            }
            Spacer()
            Menu {
                Button(role: .destructive) {
                    Task { await store.removeFriend(friend) }
                } label: {
                    Label("Remove Friend", systemImage: "person.badge.minus")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .foregroundStyle(.white.opacity(0.4))
                    .padding(.horizontal, 6)
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(friend.displayName), \(friend.gamesCompletedToday) wins today")
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "person.2")
                .font(.system(size: 44))
                .foregroundStyle(.white.opacity(0.2))
            Text("No friends yet")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.4))
            Text("Invite friends or import from Game Center to compete on the leaderboard.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.3))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .padding(.top, 40)
    }

    // MARK: - Shared helpers

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.4))
            Text("\(count)")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.25))
            Spacer()
        }
    }

    private func avatarCircle(name: String, url: String? = nil) -> some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.1)).frame(width: 38, height: 38)
            if let urlStr = url, let u = URL(string: urlStr) {
                AsyncImage(url: u) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFill().frame(width: 38, height: 38).clipShape(Circle())
                    } else {
                        initials(name)
                    }
                }
            } else {
                initials(name)
            }
        }
    }

    private func initials(_ name: String) -> some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.subheadline.bold())
            .foregroundStyle(.white.opacity(0.6))
    }
}

// MARK: - UIKit Share sheet bridge

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
