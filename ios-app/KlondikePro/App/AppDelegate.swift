import UIKit

/// DEV-309 — minimal UIApplicationDelegate, attached to the SwiftUI App via
/// `@UIApplicationDelegateAdaptor`, solely to receive the APNs device-token
/// callbacks (which have no SwiftUI equivalent) and forward them to
/// `PushNotificationManager`.
final class AppDelegate: NSObject, UIApplicationDelegate {

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
