import SwiftUI

/// Root navigation shell.
/// iPhone: TabView with bottom tab bar.
/// iPad:   NavigationSplitView with sidebar (added Sprint iOS-11).
struct ContentView: View {

    @Environment(AuthStore.self) private var authStore
    @State private var selectedTab: AppTab = .home

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(AppTab.home)

            Text("Game") // replaced Sprint iOS-4
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
    }
}

enum AppTab: Hashable {
    case home, game, daily, profile, friends
}
