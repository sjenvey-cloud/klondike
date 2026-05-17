import SwiftUI

@main
struct KlondikeProApp: App {

    @State private var authStore = AuthStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if authStore.isAuthenticated {
                    ContentView()
                } else {
                    LoginView()
                }
            }
            .environment(authStore)
            .task {
                // Attempt silent token refresh on launch
                await authStore.tryRefreshOnLaunch()
            }
        }
    }
}
