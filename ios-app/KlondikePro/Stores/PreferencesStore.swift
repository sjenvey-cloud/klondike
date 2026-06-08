import Foundation
import SwiftUI

// MARK: - PreferencesStore (DEV-286)

/// Manages user preferences: fetches from /api/v1/profile/preferences on login
/// and PATCHes on each setting change.
///
/// One instance lives in ContentView and is injected via the environment.
@MainActor
@Observable
final class PreferencesStore {

    // MARK: - Preferences (live value from backend; defaults used until fetch completes)

    private(set) var preferences: Preferences = .defaults
    var isLoading = false

    // MARK: - Computed SwiftUI Colors (used for environment injection)

    var feltColor: Color      { Color(hex: preferences.feltColour) }
    var cardBackColor: Color  { Color(hex: preferences.cardBackColour) }

    // MARK: - Fetch

    func fetchPreferences() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            preferences = try await APIClient.shared.get("/api/v1/profile/preferences")
        } catch {
            // Keep defaults — preferences are cosmetic; errors are silent.
        }
    }

    // MARK: - Patch helpers (optimistic update: mutate locally first, then sync)

    func setDrawModeDefault(_ value: String) async {
        preferences.drawModeDefault = value
        await patch(.init(drawModeDefault: value))
    }

    func setCardBackColour(_ hex: String) async {
        preferences.cardBackColour = hex
        await patch(.init(cardBackColour: hex))
    }

    /// Card face artwork style — "classic" | "modern" | "fantasy" (shared with web).
    func setCardStyle(_ value: String) async {
        preferences.cardStyle = value
        await patch(.init(cardStyle: value))
    }

    func setFeltColour(_ hex: String) async {
        preferences.feltColour = hex
        await patch(.init(feltColour: hex))
    }

    /// DEV-337: select a named felt theme — records both the felt hex and the
    /// canonical theme name so the choice is recognised on web too.
    func setTheme(name: String, felt hex: String) async {
        preferences.feltColour = hex
        preferences.themeName  = name
        await patch(.init(feltColour: hex, themeName: name))
    }

    func setAnimationSpeed(_ value: String) async {
        preferences.animationSpeed = value
        await patch(.init(animationSpeed: value))
    }

    func setWinAnimation(_ value: String) async {
        preferences.winAnimation = value
        await patch(.init(winAnimation: value))
    }

    func setStockSide(_ value: String) async {
        preferences.stockSide = value
        await patch(.init(stockSide: value))
    }

    // MARK: - Daily reminder (DEV-314)

    /// Enable the daily reminder at a local time, or disable it.
    /// `time` is "HH:mm" local; the device's current UTC offset is sent alongside
    /// so the backend scheduler can fire at the user's local time.
    func setDailyReminder(enabled: Bool, time: String) async {
        let offsetMinutes = TimeZone.current.secondsFromGMT() / 60
        if enabled {
            preferences.dailyReminderTime = time
            await patch(.init(dailyReminderTime: time, dailyReminderTzOffset: offsetMinutes))
        } else {
            preferences.dailyReminderTime = nil
            await patch(.init(dailyReminderTime: "", dailyReminderTzOffset: offsetMinutes))
        }
    }

    func setAnimationsEnabled(_ value: Bool) async {
        preferences.animationsEnabled = value
        await patch(.init(animationsEnabled: value))
    }

    // MARK: - Private

    private func patch(_ req: PatchPreferencesRequest) async {
        do {
            preferences = try await APIClient.shared.patch(
                "/api/v1/profile/preferences",
                body: req
            )
        } catch {
            // Silent — optimistic update already applied locally.
        }
    }
}
