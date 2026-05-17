import Foundation
import Observation

/// Observable auth state store. Injected via `.environment(authStore)` at the root.
///
/// On launch:
///  1. Load access token from Keychain — if present, mark authenticated and push
///     token into APIClient, then attempt a silent refresh to renew it.
///  2. If no token, remain unauthenticated → LoginView shown.
@Observable
final class AuthStore {

    // MARK: - Published state

    var user: ProfileResponse?
    var isAuthenticated: Bool = false
    var isLoading: Bool = false
    var errorMessage: String?

    // MARK: - Private

    private let authService = AuthService()

    // MARK: - Launch

    /// Called from KlondikeProApp.task — attempts silent refresh using stored
    /// Keychain token. If Keychain is empty the user sees LoginView.
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

        do {
            try await authService.refresh()
            await fetchProfile()
            isAuthenticated = true
        } catch {
            // Refresh failed — clear tokens and show login
            Keychain.clearAll()
            await APIClient.shared.setAccessToken(nil)
        }
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            _ = try await authService.login(email: email, password: password)
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
            _ = try await authService.register(
                email: email, password: password, displayName: displayName)
            await wireRefreshHandler()
            await fetchProfile()
            isAuthenticated = true
        } catch {
            errorMessage = friendlyError(error)
        }
    }

    // MARK: - Game Center login (Sprint iOS-2)

    func loginWithGameCenter(request: GameCenterAuthRequest) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            _ = try await authService.loginWithGameCenter(request: request)
            await wireRefreshHandler()
            await fetchProfile()
            isAuthenticated = true
        } catch {
            errorMessage = friendlyError(error)
        }
    }

    // MARK: - Logout

    func logout() async {
        try? await authService.logout()
        user = nil
        isAuthenticated = false
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
