import Foundation

/// Wraps all `/api/v1/auth/**` endpoints.
/// Tokens are stored in Keychain by this service;
/// the in-flight access token is also pushed into APIClient.
struct AuthService {

    private let api = APIClient.shared

    // MARK: - Login

    func login(email: String, password: String) async throws -> AuthResponse {
        let body = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await api.post("/api/v1/auth/login", body: body)
        await storeToken(response.accessToken)
        return response
    }

    // MARK: - Register

    func register(email: String, password: String, displayName: String) async throws -> AuthResponse {
        let body = RegisterRequest(email: email, password: password, displayName: displayName)
        let response: AuthResponse = try await api.post("/api/v1/auth/register", body: body)
        await storeToken(response.accessToken)
        return response
    }

    // MARK: - Refresh

    /// Silent token refresh using the HttpOnly refresh token cookie.
    /// The refresh token is sent automatically as a cookie by URLSession
    /// because the server sets `SameSite=Strict; Path=/api/v1/auth`.
    func refresh() async throws {
        let response: RefreshResponse = try await api.postEmpty("/api/v1/auth/refresh")
        await storeToken(response.accessToken)
    }

    // MARK: - Logout

    func logout() async throws {
        try await api.postVoid("/api/v1/auth/logout")
        await clearTokens()
    }

    // MARK: - Game Center (Sprint iOS-2)

    func loginWithGameCenter(request: GameCenterAuthRequest) async throws -> AuthResponse {
        let response: AuthResponse = try await api.post("/api/v1/auth/game-center", body: request)
        await storeToken(response.accessToken)
        return response
    }

    // MARK: - Helpers

    private func storeToken(_ token: String) async {
        Keychain.save(token, for: .accessToken)
        await APIClient.shared.setAccessToken(token)
    }

    private func clearTokens() async {
        Keychain.clearAll()
        await APIClient.shared.setAccessToken(nil)
    }
}

// Extend APIClient with a simple setter (actor-safe)
extension APIClient {
    func setAccessToken(_ token: String?) {
        self.accessToken = token
    }
}
