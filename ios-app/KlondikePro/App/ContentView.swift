import SwiftUI

/// Root navigation shell.
/// iPhone: TabView with bottom tab bar.
/// iPad:   NavigationSplitView with sidebar (added Sprint iOS-11).
struct ContentView: View {

    @Environment(AuthStore.self) private var authStore
    @State private var selectedTab: AppTab  = .home
    @State private var gameStore            = GameStore(userId: 0)
    @State private var dailyStore           = DailyStore()
    @State private var profileStore         = ProfileStore()
    @State private var preferencesStore     = PreferencesStore()
    @State private var leaderboardStore     = LeaderboardStore()
    @State private var friendsStore         = FriendsStore()

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(gameStore: gameStore, selectedTab: $selectedTab)
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(AppTab.home)

            GameView(store: gameStore)
                .tabItem { Label("Game", systemImage: "suit.club.fill") }
                .tag(AppTab.game)

            DailyView()
                .environment(dailyStore)
                .tabItem { Label("Daily", systemImage: "calendar") }
                .tag(AppTab.daily)

            ProfileView()
                .environment(profileStore)
                .environment(authStore)
                .environment(preferencesStore)
                .tabItem { Label("Profile", systemImage: "person.fill") }
                .tag(AppTab.profile)

            FriendsView()
                .environment(friendsStore)
                .environment(authStore)
                .environment(leaderboardStore)
                .tabItem { Label("Social", systemImage: "person.2.fill") }
                .tag(AppTab.social)
                .badge(friendsStore.socialBadgeCount)
        }
        .tint(.yellow)
        // Propagate PreferencesStore and derived environment values to the whole hierarchy
        .environment(preferencesStore)
        .environment(\.feltColor,     preferencesStore.feltColor)
        .environment(\.cardBackColor, preferencesStore.cardBackColor)
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
            }
        }
    }
}

enum AppTab: Hashable {
    case home, game, daily, profile, social
}
