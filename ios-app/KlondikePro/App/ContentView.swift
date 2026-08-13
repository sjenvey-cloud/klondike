import SwiftUI

/// Root navigation shell — a bottom TabView on every device.
///
/// (DEV-315 originally trialled a NavigationSplitView sidebar on iPad, but a
/// persistent sidebar steals ~320pt of width that the Klondike board needs, so
/// the tab bar is used on iPad too — full-width board, identical UX everywhere.)
struct ContentView: View {

    @Environment(AuthStore.self) private var authStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTab: AppTab  = .home
    @State private var wasBackgrounded      = false
    @State private var gameStore            = GameStore(userId: 0)
    @State private var dailyStore           = DailyStore()
    @State private var profileStore         = ProfileStore()
    @State private var preferencesStore     = PreferencesStore()
    @State private var leaderboardStore     = LeaderboardStore()
    @State private var friendsStore         = FriendsStore()

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(AppTab.allCases) { tab in
                destination(for: tab)
                    .tabItem { Label(tab.title, systemImage: tab.icon) }
                    .tag(tab)
                    .badge(tab == .social ? friendsStore.socialBadgeCount : 0)
            }
        }
        .tint(.yellow)
        // Propagate PreferencesStore and derived environment values to the whole hierarchy
        .environment(preferencesStore)
        .environment(\.feltColor,     preferencesStore.feltColor)
        .environment(\.cardBackColor, preferencesStore.cardBackColor)
        .environment(\.cardStyle,     preferencesStore.preferences.cardStyle)
        .onChange(of: authStore.userId) { _, newId in
            if let id = newId {
                gameStore.userId         = id
                dailyStore.userId        = id
                profileStore.userId      = id
                friendsStore.userId      = id
                leaderboardStore.userUuid = authStore.user?.uuid
                Task { await preferencesStore.fetchPreferences() }
            }
        }
        .onAppear {
            if let id = authStore.userId {
                gameStore.userId         = id
                dailyStore.userId        = id
                profileStore.userId      = id
                friendsStore.userId      = id
                leaderboardStore.userUuid = authStore.user?.uuid
                // Only fetch preferences here when the profile is already loaded
                // (i.e. after login). On a cold launch the access token may be
                // stale and a background refresh is in flight — fetching now would
                // race the refresh (token rotation) and silently fail. In that case
                // the onChange(user) handler below fetches once the profile loads
                // with a fresh token.
                if authStore.user != nil {
                    Task { await preferencesStore.fetchPreferences() }
                }
            }
        }
        // Profile loaded (post-refresh on launch) — now the token is fresh, so it's
        // safe to load preferences and sync the leaderboard identity.
        .onChange(of: authStore.user?.uuid) { _, uuid in
            leaderboardStore.userUuid = uuid
            if uuid != nil {
                Task { await preferencesStore.fetchPreferences() }
                // Report device region and prime the Social badge so incoming
                // connect requests show without first visiting the tab.
                Task {
                    await friendsStore.updateLocation()
                    await refreshSocialBadge()
                }
            }
        }
        // DEV-338: snapshot in-progress games to the server when the app is paused
        // (backgrounded / inactive) so they can be resumed on another device.
        // Also re-validate the session when returning from a real background — a long
        // suspension can expire the token, and without this Daily/calendar/stats
        // silently fail to load until relaunch.
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                if wasBackgrounded {
                    wasBackgrounded = false
                    Task {
                        await authStore.revalidateOnForeground()
                        await refreshSocialBadge()
                    }
                }
            case .background, .inactive:
                if phase == .background { wasBackgrounded = true }
                Task {
                    await gameStore.saveProgress()
                    if let dailyGame = dailyStore.gameStore {
                        await dailyGame.saveProgress()
                    }
                }
            @unknown default:
                break
            }
        }
    }

    // MARK: - Social badge

    /// Prime the Social tab badge without marking accepted acknowledgments as seen
    /// (only visiting the Social tab clears those).
    private func refreshSocialBadge() async {
        await friendsStore.fetchReceivedRequests()
        await friendsStore.fetchAcceptedRequests()
        await friendsStore.fetchPendingChallengeCount()
    }

    // MARK: - Tab content

    @ViewBuilder
    private func destination(for tab: AppTab) -> some View {
        switch tab {
        case .home:
            HomeView(gameStore: gameStore, selectedTab: $selectedTab)
        case .game:
            GameView(store: gameStore, showsResume: true)
                .environment(friendsStore)   // win screen → Challenge Friends compose
        case .daily:
            DailyView()
                .environment(dailyStore)
                .environment(friendsStore)   // daily leaderboard → Connect button
        case .profile:
            ProfileView()
                .environment(profileStore)
                .environment(authStore)
                .environment(preferencesStore)
                .environment(friendsStore)   // DEV-344: challenge compose needs friends + leagues
        case .social:
            FriendsView()
                .environment(friendsStore)
                .environment(authStore)
                .environment(leaderboardStore)
        }
    }
}

enum AppTab: String, CaseIterable, Identifiable, Hashable {
    case home, game, daily, profile, social

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home:    return "Home"
        case .game:    return "Game"
        case .daily:   return "Daily"
        case .profile: return "Profile"
        case .social:  return "Social"
        }
    }

    var icon: String {
        switch self {
        case .home:    return "house.fill"
        case .game:    return "suit.club.fill"
        case .daily:   return "calendar"
        case .profile: return "person.fill"
        case .social:  return "person.2.fill"
        }
    }
}
