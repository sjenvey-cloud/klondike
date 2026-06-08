import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// DEV-340: lightweight haptic feedback for gameplay events.
///
/// Centralises every haptic so call sites stay a one-liner and the user's
/// preference is honoured in one place. Gated on a UserDefaults flag (default on)
/// so it can be toggled from Settings without a backend round-trip. No-ops on
/// platforms without UIKit (e.g. previews / non-iOS builds).
enum Haptics {

    static let prefKey = "klondike_haptics_enabled"

    /// Honour the user's toggle; defaults to ON when never set.
    private static var enabled: Bool {
        UserDefaults.standard.object(forKey: prefKey) == nil
            ? true
            : UserDefaults.standard.bool(forKey: prefKey)
    }

    /// A legal card move landed (card placed on tableau/foundation).
    static func move() {
        #if canImport(UIKit)
        guard enabled else { return }
        let g = UIImpactFeedbackGenerator(style: .light)
        g.impactOccurred()
        #endif
    }

    /// A card was drawn / the stock recycled — a subtle tick.
    static func draw() {
        #if canImport(UIKit)
        guard enabled else { return }
        let g = UIImpactFeedbackGenerator(style: .soft)
        g.impactOccurred(intensity: 0.6)
        #endif
    }

    /// The user tapped a card that has nowhere legal to go.
    static func invalid() {
        #if canImport(UIKit)
        guard enabled else { return }
        let g = UINotificationFeedbackGenerator()
        g.notificationOccurred(.warning)
        #endif
    }

    /// The game was won — a celebratory success pattern.
    static func win() {
        #if canImport(UIKit)
        guard enabled else { return }
        let g = UINotificationFeedbackGenerator()
        g.notificationOccurred(.success)
        #endif
    }
}
