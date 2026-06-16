import SwiftUI

/// Pick friends and/or leagues to challenge on a won hand, then send — mirroring
/// the web flow (select a hand → choose friends/leagues → send). Both selections
/// are sent (possibly empty) so the backend uses the explicit-invite path.
///
/// Used from the profile-calendar day detail (DEV-344) and the win screen
/// (DEV: "Challenge Friends" action). Requires a FriendsStore in the environment.
struct ChallengeComposeSheet: View {

    let sessionUuid: UUID
    var onSent: () -> Void

    @Environment(FriendsStore.self) private var store
    @Environment(\.dismiss)         private var dismiss

    @State private var selectedFriendIds: Set<Int> = []
    @State private var selectedLeagueIds: Set<Int> = []
    @State private var isSending = false
    @State private var loaded    = false

    private var canSend: Bool {
        !isSending && (!selectedFriendIds.isEmpty || !selectedLeagueIds.isEmpty)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

                if !loaded {
                    ProgressView().tint(.yellow).scaleEffect(1.2)
                } else if store.friends.isEmpty && store.customLeagues.isEmpty {
                    emptyState
                } else {
                    List {
                        if !store.friends.isEmpty {
                            Section("Friends") {
                                ForEach(store.friends) { friend in
                                    row(title: friend.displayName,
                                        subtitle: nil,
                                        isOn: selectedFriendIds.contains(friend.userId)) {
                                        if selectedFriendIds.contains(friend.userId) {
                                            selectedFriendIds.remove(friend.userId)
                                        } else {
                                            selectedFriendIds.insert(friend.userId)
                                        }
                                    }
                                }
                            }
                        }
                        if !store.customLeagues.isEmpty {
                            Section("Leagues") {
                                ForEach(store.customLeagues) { league in
                                    row(title: league.name,
                                        subtitle: "\(league.memberCount) member\(league.memberCount == 1 ? "" : "s")",
                                        isOn: selectedLeagueIds.contains(league.id)) {
                                        if selectedLeagueIds.contains(league.id) {
                                            selectedLeagueIds.remove(league.id)
                                        } else {
                                            selectedLeagueIds.insert(league.id)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Challenge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(.yellow)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task {
                            isSending = true
                            let ok = await store.createChallenge(
                                fromSessionUuid: sessionUuid,
                                invitedUserIds: Array(selectedFriendIds),
                                invitedLeagueIds: Array(selectedLeagueIds)
                            )
                            isSending = false
                            if ok { onSent(); dismiss() }
                        }
                    } label: {
                        if isSending {
                            ProgressView().tint(.yellow)
                        } else {
                            Text("Send").bold()
                        }
                    }
                    .foregroundStyle(canSend ? .yellow : .gray)
                    .disabled(!canSend)
                }
            }
            .task {
                await store.fetchFriends()
                await store.fetchCustomLeagues()
                loaded = true
            }
        }
    }

    private func row(title: String, subtitle: String?, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).foregroundStyle(.white)
                    if let subtitle {
                        Text(subtitle).font(.caption).foregroundStyle(.white.opacity(0.5))
                    }
                }
                Spacer()
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isOn ? .yellow : .white.opacity(0.3))
            }
        }
        .listRowBackground(Color.white.opacity(0.04))
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 40)).foregroundStyle(.white.opacity(0.2))
            Text("No friends or leagues yet")
                .font(.subheadline).foregroundStyle(.white.opacity(0.5))
            Text("Add friends or create a league in the Social tab first.")
                .font(.caption).foregroundStyle(.white.opacity(0.35))
                .multilineTextAlignment(.center).padding(.horizontal, 32)
        }
    }
}
