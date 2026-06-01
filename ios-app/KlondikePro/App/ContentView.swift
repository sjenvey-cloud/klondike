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

            NavigationStack {
                LeaderboardView()
                    .environment(leaderboardStore)
            }
            .tabItem { Label("Rankings", systemImage: "trophy.fill") }
            .tag(AppTab.rankings)
        }
        .tint(.yellow)
        // Propagate felt + card-back colours from PreferencesStore into the whole hierarchy
        .environment(\.feltColor,     preferencesStore.feltColor)
        .environment(\.cardBackColor, preferencesStore.cardBackColor)
        .onChange(of: authStore.userId) { _, newId in
            if let id = newId {
                gameStore.userId         = id
                dailyStore.userId        = id
                profileStore.userId      = id
                leaderboardStore.userUuid = authStore.user?.uuid
                Task { await preferencesStore.fetchPreferences() }
            }
        }
        .onAppear {
            if let id = authStore.userId {
                gameStore.userId         = id
                dailyStore.userId        = id
                profileStore.userId      = id
                leaderboardStore.userUuid = authStore.user?.uuid
                Task { await preferencesStore.fetchPreferences() }
            }
        }
        // Keep leaderboardStore.userUuid in sync if the user profile loads after initial appear
        .onChange(of: authStore.user?.uuid) { _, uuid in
            leaderboardStore.userUuid = uuid
        }
    }
}

enum AppTab: Hashable {
    case home, game, daily, profile, rankings
}
