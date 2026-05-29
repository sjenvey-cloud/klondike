import Foundation
import Observation

/// Observable auth state store. Injected via `.environment(authStore)` at the root.
///
/// On launch:
///  1. Load access token from Keychain — if present, mark authenticated and push
///     token into APIClient, then attempt a silent refresh to renew it.
///  2. If no token, remain unauthenticated → LoginView shown.
@MainActor
@Observable
final class AuthStore {

    // MARK: - Published state

    var user: ProfileResponse?
    var isAuthenticated: Bool = false
    var isLoading: Bool = false
    var errorMessage: String?
    var userId: Int?

    // MARK: - Private

    private let authService = AuthService()

    // MARK: - Launch

    /// Called from KlondikeProApp.task — attempts silent refresh using stored
    /// Keychain token. If Keychain is empty the user sees LoginView.
    ///
    /// Uses optimistic auth: if a stored token exists we mark the user as
    /// authenticated immediately (so ContentView renders without waiting for a
    /// network round-trip), then refresh silently in the background.  If the
    /// refresh fails we revert to unauthenticated state so LoginView is shown.
    func tryRefreshOnLaunch() async {
        guard let storedToken = Keychain.load(.accessToken) else {
            return  // no token → show login
        }
        // Push stored token so APIClient is ready for the refresh call
        await APIClient.shared.setAccessToken(storedToken)

        // Wire up the refresh handler so APIClient can refresh silently on 401
        await APIClient.shared.setRefreshHandler { [weak self] in
            try await self?.authService.refresh()
        }

        // Restore userId — try UserDefaults first (fast path), fall back to
        // Keychain which persists across Xcode reinstalls unlike UserDefaults.
        var storedId = UserDefaults.standard.integer(forKey: "klondike_user_id")
        if storedId == 0,
           let raw = Keychain.load(.userId),
           let keychainId = Int(raw), keychainId > 0 {
            storedId = keychainId
            UserDefaults.standard.set(keychainId, forKey: "klondike_user_id")
        }
        if storedId > 0 { userId = storedId }

        // Optimistically authenticate now — ContentView appears immediately.
        // The background refresh below will revert if the token is no longer valid.
        isAuthenticated = true

        // Background refresh: renew the access token without blocking the UI.
        Task { [weak self] in
            guard let self else { return }
            do {
                try await authService.refresh()
                await fetchProfile()
            } catch {
                // Refresh failed — stored token is no longer valid; show login.
                Keychain.clearAll()
                await APIClient.shared.setAccessToken(nil)
                userId = nil
                isAuthenticated = false
            }
        }
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let auth = try await authService.login(email: email, password: password)
            userId = auth.user.id
            UserDefaults.standard.set(auth.user.id, forKey: "klondike_user_id")
            Keychain.save(String(auth.user.id), for: .userId)
            await wireRefreshHandler()
            await fetchProfile()
            isAuthenticated = true
        } catch {
            errorMessage = friendlyError(error)
        }
    }

    // MARK: - Register

    func register(email: String, password: String, displayName: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let auth = try await authService.register(
                email: email, password: password, displayName: displayName)
            userId = auth.user.id
            UserDefaults.standard.set(auth.user.id, forKey: "klondike_user_id")
            Keychain.save(String(auth.user.id), for: .userId)
            await wireRefreshHandler()
            await fetchProfile()
            isAuthenticated = true
        } catch {
            errorMessage = friendlyError(error)
        }
    }

    // MARK: - Game Center login (DEV-249/250)

    /// Calls GameCenterService to authenticate with GK and fetch the ECDSA
    /// identity signature, then POSTs it to /api/v1/auth/game-center.
    func loginWithGameCenter() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let request = try await GameCenterService.shared.authenticate()
            let auth = try await authService.loginWithGameCenter(request: request)
            userId = auth.user.id
            UserDefaults.standard.set(auth.user.id, forKey: "klondike_user_id")
            Keychain.save(String(auth.user.id), for: .userId)
            await wireRefreshHandler()
            await fetchProfile()
            isAuthenticated = true
        } catch let gcError as GameCenterError {
            errorMessage = gcError.localizedDescription
        } catch {
            errorMessage = friendlyError(error)
        }
    }

    // MARK: - Logout

    func logout() async {
        try? await authService.logout()
        user = nil
        isAuthenticated = false
        UserDefaults.standard.removeObject(forKey: "klondike_user_id")
        Keychain.delete(.userId)
        userId = nil
    }

    // MARK: - Helpers

    private func fetchProfile() async {
        user = try? await APIClient.shared.get("/api/v1/profile")
    }

    private func wireRefreshHandler() async {
        await APIClient.shared.setRefreshHandler { [weak self] in
            try await self?.authService.refresh()
        }
    }

    private func friendlyError(_ error: Error) -> String {
        if let api = error as? APIError {
            switch api {
            case .httpError(401, _): return "Incorrect email or password."
            case .httpError(409, _): return "An account with this email already exists."
            case .refreshFailed:     return "Session expired. Please log in again."
            default: break
            }
        }
        return error.localizedDescription
    }
}

// Extend APIClient with refresh handler setter (actor-safe)
extension APIClient {
    func setRefreshHandler(_ handler: @escaping () async throws -> Void) {
        self.refreshHandler = handler
    }
}
