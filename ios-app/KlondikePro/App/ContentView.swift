import SwiftUI

/// Root navigation shell.
/// iPhone: TabView with bottom tab bar.
/// iPad:   NavigationSplitView with sidebar (added Sprint iOS-11).
struct ContentView: View {

    @Environment(AuthStore.self) private var authStore
    @State private var selectedTab: AppTab = .home

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Home", systemImage: "house.fill", value: AppTab.home) {
                HomeView()
            }
            Tab("Game", systemImage: "suit.club.fill", value: AppTab.game) {
                Text("Game") // replaced Sprint iOS-4
            }
            Tab("Daily", systemImage: "calendar", value: AppTab.daily) {
                Text("Daily") // replaced Sprint iOS-5
            }
            Tab("Profile", systemImage: "person.fill", value: AppTab.profile) {
                Text("Profile") // replaced Sprint iOS-6
            }
            Tab("Friends", systemImage: "person.2.fill", value: AppTab.friends) {
                Text("Friends") // replaced Sprint iOS-8
            }
        }
        .tint(.yellow)
    }
}

enum AppTab: Hashable {
    case home, game, daily, profile, friends
}
