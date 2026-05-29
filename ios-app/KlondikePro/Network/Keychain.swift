import Foundation
import Security

/// Wrapper around the iOS Keychain for secure token storage.
/// Access tokens and refresh tokens are never stored in UserDefaults.
enum Keychain {

    private static let service = "com.klondikepro.app"

    enum Key: String {
        case accessToken  = "access_token"
        case refreshToken = "refresh_token"
        case userId       = "user_id"       // integer stored as decimal string; survives reinstall
    }

    // MARK: - Save

    @discardableResult
    static func save(_ value: String, for key: Key) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }

        // Delete any existing item first
        delete(key)

        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrService:      service,
            kSecAttrAccount:      key.rawValue,
            kSecValueData:        data,
            kSecAttrAccessible:   kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    // MARK: - Load

    static func load(_ key: Key) -> String? {
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrService:      service,
            kSecAttrAccount:      key.rawValue,
            kSecReturnData:       true,
            kSecMatchLimit:       kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }
        return string
    }

    // MARK: - Delete

    @discardableResult
    static func delete(_ key: Key) -> Bool {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key.rawValue
        ]
        return SecItemDelete(query as CFDictionary) == errSecSuccess
    }

    // MARK: - Clear all

    static func clearAll() {
        Key.allCases.forEach { delete($0) }
    }
}

extension Keychain.Key: CaseIterable {}
