import Foundation
import UIKit
import UserNotifications

/// DEV-308 / DEV-309 — owns the push-notification lifecycle:
///   1. Request user authorization (alerts / badges / sounds) — once, on first launch.
///   2. On grant, register with APNs.
///   3. When `AppDelegate` receives the device token, POST it to the backend.
///
/// A single instance is held at `PushNotificationManager.shared`. The APNs token
/// callback arrives on the `UIApplicationDelegate`, which forwards it here.
@MainActor
final class PushNotificationManager {

    static let shared = PushNotificationManager()
    private init() {}

    /// The last token we successfully sent — avoids re-POSTing an unchanged token
    /// on every launch. Persisted so it survives app restarts.
    private var lastSentToken: String? {
        get { UserDefaults.standard.string(forKey: "klondike_last_apns_token") }
        set { UserDefaults.standard.set(newValue, forKey: "klondike_last_apns_token") }
    }

    // MARK: - DEV-308: permission + registration

    /// Requests notification authorization (no-op prompt if already decided) and,
    /// when granted, registers with APNs. Safe to call on every launch / login —
    /// iOS only shows the system prompt the first time.
    func requestAuthorizationAndRegister() async {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else { return }   // user declined — respect their choice
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            // Authorization failed/unavailable (e.g. simulator without push) — ignore.
        }
    }

    // MARK: - DEV-309: token handling

    /// Called by `AppDelegate` when APNs returns a device token.
    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { await sendToBackend(token: token) }
    }

    /// Called by `AppDelegate` if APNs registration fails (logged only).
    func didFailToRegister(error: Error) {
        // Non-fatal — registration is retried on the next launch.
    }

    private func sendToBackend(token: String) async {
        guard token != lastSentToken else { return }   // unchanged — nothing to do
        guard let deviceId = UIDevice.current.identifierForVendor?.uuidString else { return }

        do {
            try await APIClient.shared.postBodyVoid(
                "/api/v1/profile/device-token",
                body: RegisterDeviceTokenRequest(token: token, deviceId: deviceId, platform: "ios")
            )
            lastSentToken = token
        } catch {
            // Will retry on next launch (lastSentToken not updated).
        }
    }

    /// Clears the cached token so the next registration re-sends to the backend.
    /// Call on logout so a fresh login re-associates the device with the new account.
    func resetOnLogout() {
        lastSentToken = nil
    }
}
