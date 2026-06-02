import Foundation

// MARK: - APIError

enum APIError: LocalizedError {
    case invalidURL
    case httpError(statusCode: Int, body: Data?)
    case decodingError(Error)
    case noData
    case unauthorized        // 401 — triggers refresh attempt
    case refreshFailed       // 401 even after refresh — must log out

    var errorDescription: String? {
        switch self {
        case .invalidURL:               return "Invalid URL."
        case .httpError(let code, _):   return "Server error \(code)."
        case .decodingError(let e):     return "Decode error: \(e.localizedDescription)"
        case .noData:                   return "No data received."
        case .unauthorized:             return "Unauthorized."
        case .refreshFailed:            return "Session expired. Please log in again."
        }
    }
}

// MARK: - APIClient

/// Async/await URLSession wrapper.
///
/// Base URL is read from the `API_BASE_URL` key in the app's Info.plist so
/// that the production scheme uses CloudFront and the local debug scheme
/// points to localhost:8080 — no source changes needed.
///
/// All protected endpoints send `Authorization: Bearer <accessToken>`.
/// On HTTP 401 the client attempts one silent refresh via AuthService;
/// if refresh also fails it throws `APIError.refreshFailed`.
actor APIClient {

    // MARK: Shared instance

    static let shared = APIClient()

    // MARK: Properties

    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    // Injected by AuthStore after login / refresh
    var accessToken: String?

    // Closure called when a silent refresh is needed (set by AuthStore)
    var refreshHandler: (() async throws -> Void)?

    // MARK: Init

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest  = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)

        // Read base URL from Info.plist (injected from scheme environment variable)
        let raw = Bundle.main.infoDictionary?["API_BASE_URL"] as? String
                  ?? "https://d2fbehwb6bp7kq.cloudfront.net"
        self.baseURL = URL(string: raw)!

        let d = JSONDecoder()
        d.keyDecodingStrategy  = .convertFromSnakeCase
        // Custom date strategy: handles both the standard "...Z" Instant format and
        // the legacy LocalDateTime format "yyyy-MM-dd'T'HH:mm:ss" (no timezone) that
        // some older backend endpoints emit. Legacy strings are treated as UTC.
        d.dateDecodingStrategy = .custom { decoder in
            let container  = try decoder.singleValueContainer()
            let raw        = try container.decode(String.self)
            // Preferred: ISO 8601 with timezone (produced by Instant / ZonedDateTime)
            let withTZ = ISO8601DateFormatter()
            withTZ.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withTZ.date(from: raw) { return date }
            withTZ.formatOptions = [.withInternetDateTime]
            if let date = withTZ.date(from: raw) { return date }
            // Fallback: LocalDateTime without timezone — treat as UTC
            let noTZ = DateFormatter()
            noTZ.locale   = Locale(identifier: "en_US_POSIX")
            noTZ.timeZone = TimeZone(secondsFromGMT: 0)
            noTZ.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS"
            if let date = noTZ.date(from: raw) { return date }
            noTZ.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
            if let date = noTZ.date(from: raw) { return date }
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath,
                      debugDescription: "Date string not recognised: \(raw)"))
        }
        self.decoder = d

        let e = JSONEncoder()
        e.keyEncodingStrategy  = .useDefaultKeys   // backend uses camelCase (no snake_case mapping)
        e.dateEncodingStrategy = .iso8601
        self.encoder = e
    }

    // MARK: - Public request methods

    /// GET and decode a Decodable response.
    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        let req = try makeRequest(method: "GET", path: path, query: query)
        return try await perform(req)
    }

    /// POST with an Encodable body, decode Decodable response.
    func post<Body: Encodable, Response: Decodable>(
        _ path: String, body: Body
    ) async throws -> Response {
        var req = try makeRequest(method: "POST", path: path)
        req.httpBody = try encoder.encode(body)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await perform(req)
    }

    /// POST with no body (e.g. refresh, logout, accept invite).
    func postEmpty<Response: Decodable>(_ path: String) async throws -> Response {
        let req = try makeRequest(method: "POST", path: path)
        return try await perform(req)
    }

    /// POST with no body, no response body expected (204).
    func postVoid(_ path: String) async throws {
        let req = try makeRequest(method: "POST", path: path)
        let _: EmptyResponse = try await perform(req, allow204: true)
    }

    /// PATCH with an Encodable body, decode response.
    func patch<Body: Encodable, Response: Decodable>(
        _ path: String, body: Body
    ) async throws -> Response {
        var req = try makeRequest(method: "PATCH", path: path)
        req.httpBody = try encoder.encode(body)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await perform(req)
    }

    /// PATCH with no response body (204).
    func patchVoid<Body: Encodable>(_ path: String, body: Body) async throws {
        var req = try makeRequest(method: "PATCH", path: path)
        req.httpBody = try encoder.encode(body)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let _: EmptyResponse = try await perform(req, allow204: true)
    }

    /// DELETE with no response body.
    func deleteVoid(_ path: String) async throws {
        let req = try makeRequest(method: "DELETE", path: path)
        let _: EmptyResponse = try await perform(req, allow204: true)
    }

    /// POST with an Encodable body, no response body expected (204).
    func postBodyVoid<Body: Encodable>(_ path: String, body: Body) async throws {
        var req = try makeRequest(method: "POST", path: path)
        req.httpBody = try encoder.encode(body)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let _: EmptyResponse = try await perform(req, allow204: true)
    }

    /// DELETE with an Encodable body (e.g. account deletion requires password).
    func deleteWithBody<Body: Encodable>(_ path: String, body: Body) async throws {
        var req = try makeRequest(method: "DELETE", path: path)
        req.httpBody = try encoder.encode(body)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let _: EmptyResponse = try await perform(req, allow204: true)
    }

    // MARK: - Health check (unauthenticated)

    func healthCheck() async throws -> Bool {
        let url = baseURL.appendingPathComponent("/actuator/health")
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            return false
        }
        // { "status": "UP" }
        return data.contains(UInt8(ascii: "U"))
    }

    // MARK: - Private helpers

    private func makeRequest(
        method: String,
        path: String,
        query: [String: String] = [:]
    ) throws -> URLRequest {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty {
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw APIError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    private func perform<T: Decodable>(
        _ request: URLRequest,
        allow204: Bool = false,
        retryingAfterRefresh: Bool = false
    ) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.noData
        }

        // 401 — try a silent refresh once
        if http.statusCode == 401 && !retryingAfterRefresh {
            guard let refresh = refreshHandler else { throw APIError.unauthorized }
            do {
                try await refresh()
            } catch {
                throw APIError.refreshFailed
            }
            // Rebuild request with new token and retry
            var retried = request
            if let token = accessToken {
                retried.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            return try await perform(retried, allow204: allow204, retryingAfterRefresh: true)
        }

        // 204 No Content
        if http.statusCode == 204 && allow204 {
            // Return an empty placeholder — caller ignores it
            if T.self == EmptyResponse.self {
                return EmptyResponse() as! T
            }
        }

        guard (200...299).contains(http.statusCode) else {
            throw APIError.httpError(statusCode: http.statusCode, body: data)
        }

        if data.isEmpty && allow204 {
            if T.self == EmptyResponse.self {
                return EmptyResponse() as! T
            }
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}

// Sentinel type for 204 / void responses
private struct EmptyResponse: Codable {}
