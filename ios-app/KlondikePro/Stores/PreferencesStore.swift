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

    func setFeltColour(_ hex: String) async {
        preferences.feltColour = hex
        await patch(.init(feltColour: hex))
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
