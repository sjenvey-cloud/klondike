import UIKit
import GameKit

/// DEV-309 — minimal UIApplicationDelegate, attached to the SwiftUI App via
/// `@UIApplicationDelegateAdaptor`, solely to receive the APNs device-token
/// callbacks (which have no SwiftUI equivalent) and forward them to
/// `PushNotificationManager`.
final class AppDelegate: NSObject, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // DEV-327: subscribe to MetricKit early so crash/hang diagnostics from the
        // previous run are delivered.
        MetricsReporter.shared.start()
        // Authenticate Game Center at launch so the player is signed in (banner
        // shows) and Daily Challenge leaderboard scores actually post. Without this,
        // submissions silently no-op because GKLocalPlayer isn't authenticated.
        authenticateGameCenter()
        return true
    }

    /// Sets the Game Center authenticate handler. When the device is signed into
    /// Game Center this completes silently (and shows the "Welcome back" banner);
    /// otherwise it presents the GC sign-in UI. Game Center keeps each player's best
    /// score automatically, so submissions just need an authenticated player.
    private func authenticateGameCenter() {
        GKLocalPlayer.local.authenticateHandler = { viewController, _ in
            guard let vc = viewController else { return }
            Self.topViewController()?.present(vc, animated: true)
        }
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            PushNotificationManager.shared.didRegister(deviceToken: deviceToken)
        }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in
            PushNotificationManager.shared.didFailToRegister(error: error)
        }
    }
}
