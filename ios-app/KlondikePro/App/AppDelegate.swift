import UIKit

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
        return true
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
