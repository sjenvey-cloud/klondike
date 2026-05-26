import SwiftUI

@main
struct KlondikeProApp: App {

    @State private var authStore = AuthStore()
    /// True while tryRefreshOnLaunch is running so we show a neutral splash
    /// instead of flashing LoginView before the auth check completes.
    @State private var isCheckingAuth = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                // Always-present background prevents the window showing through
                // as black while views are being composed.
                Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

                if isCheckingAuth {
                    // ── Splash / auth-check ──────────────────────────────
                    splashView
                } else if authStore.isAuthenticated {
                    ContentView()
                } else {
                    LoginView()
                }
            }
            .environment(authStore)
            .preferredColorScheme(.dark)   // all custom UI is dark-themed
            .task {
                await authStore.tryRefreshOnLaunch()
                isCheckingAuth = false
            }
        }
    }

    private var splashView: some View {
        VStack(spacing: 16) {
            Text("🂡")
                .font(.system(size: 80))
            Text("Klondike Pro")
                .font(.title.bold())
                .foregroundStyle(.white)
            ProgressView()
                .tint(.yellow)
                .padding(.top, 8)
        }
    }
}
