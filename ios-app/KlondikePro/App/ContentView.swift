import SwiftUI

/// Root navigation shell.
/// iPhone (compact width): TabView with a bottom tab bar.
/// iPad (regular width):   NavigationSplitView with a sidebar (DEV-315).
///
/// In a narrow window (iPad Slide Over / small Stage Manager window) the size
/// class is compact, so it falls back to the tab bar automatically (DEV-317).
struct ContentView: View {

    @Environment(AuthStore.self) private var authStore
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.horizontalSizeClass) private var hSize
    @State private var selectedTab: AppTab  = .home
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var gameStore            = GameStore(userId: 0)
    @State private var dailyStore           = DailyStore()
    @State private var profileStore         = ProfileStore()
    @State private var preferencesStore     = PreferencesStore()
    @State private var leaderboardStore     = LeaderboardStore()
    @State private var friendsStore         = FriendsStore()

    var body: some View {
        Group {
            if hSize == .regular {
                splitView
            } else {
                tabBar
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
            }
        }
        // DEV-338: snapshot in-progress games to the server when the app is paused
        // (backgrounded / inactive) so they can be resumed on another device.
        .onChange(of: scenePhase) { _, phase in
            guard phase == .background || phase == .inactive else { return }
            Task {
                await gameStore.saveProgress()
                if let dailyGame = dailyStore.gameStore {
                    await dailyGame.saveProgress()
                }
            }
        }
    }

    // MARK: - iPhone tab bar (compact width)

    private var tabBar: some View {
        TabView(selection: $selectedTab) {
            ForEach(AppTab.allCases) { tab in
                destination(for: tab)
                    .tabItem { Label(tab.title, systemImage: tab.icon) }
                    .tag(tab)
                    .badge(tab == .social ? friendsStore.socialBadgeCount : 0)
            }
        }
    }

    // MARK: - iPad split view (DEV-315, regular width)

    private var splitView: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(selection: sidebarSelection) {
                ForEach(AppTab.allCases) { tab in
                    // NavigationLink(value:) — not a plain tagged row — is what makes
                    // a NavigationSplitView sidebar respond to taps and drive the
                    // detail column.
                    NavigationLink(value: tab) {
                        Label(tab.title, systemImage: tab.icon)
                            .badge(tab == .social ? friendsStore.socialBadgeCount : 0)
                    }
                }
            }
            .navigationTitle("Klondike Pro")
            .listStyle(.sidebar)
        } detail: {
            destination(for: selectedTab)
                .id(selectedTab)
        }
        .navigationSplitViewStyle(.balanced)
    }

    /// Bridges the non-optional `selectedTab` to `List(selection:)`, which expects
    /// an optional binding.
    private var sidebarSelection: Binding<AppTab?> {
        Binding(get: { selectedTab }, set: { if let v = $0 { selectedTab = v } })
    }

    // MARK: - Tab content (shared by both layouts)

    @ViewBuilder
    private func destination(for tab: AppTab) -> some View {
        switch tab {
        case .home:
            HomeView(gameStore: gameStore, selectedTab: $selectedTab)
        case .game:
            GameView(store: gameStore, showsResume: true)
        case .daily:
            DailyView()
                .environment(dailyStore)
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
