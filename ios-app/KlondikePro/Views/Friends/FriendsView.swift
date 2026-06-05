import SwiftUI

/// DEV-293 — Social tab shell: Friends / League / Challenges.
/// Replaces the previous Rankings-only tab; the global leaderboard is reachable
/// from the League tab via a "Global Rankings" link.
struct FriendsView: View {

    @Environment(FriendsStore.self)     private var store
    @Environment(AuthStore.self)        private var authStore

    enum SocialTab: String, CaseIterable { case friends = "Friends", league = "League", challenges = "Challenges" }

    @State private var selectedTab: SocialTab = .friends

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                segmentedBar
                Divider().background(Color.white.opacity(0.1))

                Group {
                    switch selectedTab {
                    case .friends:    FriendsTab()
                    case .league:     LeagueTab()
                    case .challenges: ChallengesTab()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea())
            .navigationTitle("Social")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            store.userId = authStore.userId ?? store.userId
            Task {
                await store.fetchFriends()
                await store.fetchReceivedRequests()
                await store.fetchPendingChallengeCount()
            }
        }
        .onChange(of: selectedTab) { _, tab in
            if tab == .challenges { store.markChallengesViewed() }
        }
    }

    // MARK: - Segmented bar

    private var segmentedBar: some View {
        HStack(spacing: 8) {
            ForEach(SocialTab.allCases, id: \.self) { tab in
                let active = selectedTab == tab
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { selectedTab = tab }
                } label: {
                    HStack(spacing: 5) {
                        Text(tab.rawValue)
                            .font(.subheadline.weight(active ? .bold : .regular))
                        // Badge on the Friends tab for incoming requests
                        if tab == .friends && store.receivedRequests.count > 0 {
                            Text("\(store.receivedRequests.count)")
                                .font(.caption2.bold())
                                .foregroundStyle(.black)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color.yellow)
                                .clipShape(Capsule())
                        }
                        if tab == .challenges && store.pendingChallengeCount > 0 {
                            Circle().fill(Color.yellow).frame(width: 7, height: 7)
                        }
                    }
                    .foregroundStyle(active ? .black : .white.opacity(0.7))
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(active ? Color.yellow : Color.white.opacity(0.08))
                    .clipShape(Capsule())
                }
                .accessibilityLabel(tab.rawValue)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}
