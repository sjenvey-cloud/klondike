import SwiftUI

@main
struct KlondikeProApp: App {

    @State private var authStore = AuthStore()
    /// True while tryRefreshOnLaunch is running so we show a neutral splash
    /// instead of flashing LoginView before the auth check completes.
    @State private var isCheckingAuth = true

    /// DEV-301: pending friend-invite token parsed from a klondikepro:// deep link.
    @State private var pendingInviteToken: String?

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
            // DEV-301: handle klondikepro://friends/invite/{token}
            .onOpenURL { url in
                if let token = Self.inviteToken(from: url) {
                    pendingInviteToken = token
                }
            }
            .sheet(isPresented: Binding(
                get: { pendingInviteToken != nil && authStore.isAuthenticated },
                set: { if !$0 { pendingInviteToken = nil } }
            )) {
                if let token = pendingInviteToken {
                    AcceptInviteView(token: token) { pendingInviteToken = nil }
                }
            }
        }
    }

    /// Parses `klondikepro://friends/invite/{token}` → token.
    static func inviteToken(from url: URL) -> String? {
        guard url.scheme == "klondikepro" else { return nil }
        // Host may be "friends" with path "/invite/{token}", or the whole thing in path components.
        let parts = (url.host.map { [$0] } ?? []) + url.pathComponents.filter { $0 != "/" }
        // Expect [..., "invite", token]
        if let idx = parts.firstIndex(of: "invite"), idx + 1 < parts.count {
            return parts[idx + 1]
        }
        return nil
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
