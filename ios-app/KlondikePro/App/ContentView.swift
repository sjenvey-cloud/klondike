import SwiftUI

/// Root navigation shell.
/// iPhone: TabView with bottom tab bar.
/// iPad:   NavigationSplitView with sidebar (added Sprint iOS-11).
struct ContentView: View {

    @Environment(AuthStore.self) private var authStore
    @State private var selectedTab: AppTab = .home
    @State private var gameStore = GameStore(userId: 0)

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(gameStore: gameStore, selectedTab: $selectedTab)
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(AppTab.home)

            GameView(store: gameStore)
                .tabItem { Label("Game", systemImage: "suit.club.fill") }
                .tag(AppTab.game)

            Text("Daily") // replaced Sprint iOS-5
                .tabItem { Label("Daily", systemImage: "calendar") }
                .tag(AppTab.daily)

            Text("Profile") // replaced Sprint iOS-6
                .tabItem { Label("Profile", systemImage: "person.fill") }
                .tag(AppTab.profile)

            Text("Friends") // replaced Sprint iOS-8
                .tabItem { Label("Friends", systemImage: "person.2.fill") }
                .tag(AppTab.friends)
        }
        .tint(.yellow)
        .onChange(of: authStore.userId) { _, newId in
            if let id = newId { gameStore.userId = id }
        }
        .onAppear {
            if let id = authStore.userId { gameStore.userId = id }
        }
    }
}

enum AppTab: Hashable {
    case home, game, daily, profile, friends
}
