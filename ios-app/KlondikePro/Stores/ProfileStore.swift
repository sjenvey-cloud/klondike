import Foundation
import Observation

// MARK: - ProfileStore (DEV-279 through DEV-285)

/// Manages all state for the Profile tab:
/// profile data, stats, records, calendar heatmap, day sessions,
/// avatar upload, and account management.
///
/// One instance lives in ContentView and is injected via the environment.
@MainActor
@Observable
final class ProfileStore {

    // MARK: - Auth context (set by ContentView after login)

    var userId: Int = UserDefaults.standard.integer(forKey: "klondike_user_id")

    // MARK: - Profile data

    private(set) var profile: ProfileResponse?
    private(set) var stats: StatsResponse?
    private(set) var records: RecordsResponse?
    private(set) var calendarEntries: [ProfileCalendarEntry] = []

    // MARK: - Day detail (DEV-282)

    private(set) var daySessions: [ProfileDaySession] = []
    var isLoadingDaySessions = false

    // MARK: - Loading states

    var isLoadingProfile  = false
    var isLoadingStats    = false
    var isLoadingRecords  = false
    var isLoadingCalendar = false

    // MARK: - Error

    var errorMessage: String?

    // MARK: - Avatar upload (DEV-284)

    var isUploadingAvatar = false
    var avatarError: String?

    // MARK: - Account management (DEV-285)

    var isChangingPassword    = false
    var passwordChangeSuccess = false
    var isDeletingAccount     = false
    var accountError: String?

    /// Called when account deletion succeeds — ContentView uses this to log out.
    var onAccountDeleted: (() -> Void)?

    // MARK: - Fetch profile

    func fetchProfile() async {
        guard !isLoadingProfile else { return }
        isLoadingProfile = true
        errorMessage     = nil
        defer { isLoadingProfile = false }
        do {
            profile = try await APIClient.shared.get("/api/v1/profile")
        } catch {
            errorMessage = "Could not load profile. Check your connection."
        }
    }

    // MARK: - Fetch stats (DEV-280)

    func fetchStats() async {
        guard !isLoadingStats else { return }
        isLoadingStats = true
        defer { isLoadingStats = false }
        do {
            stats = try await APIClient.shared.get("/api/v1/profile/stats")
        } catch {
            stats = nil
        }
    }

    // MARK: - Fetch records (DEV-283)

    func fetchRecords() async {
        guard !isLoadingRecords else { return }
        isLoadingRecords = true
        defer { isLoadingRecords = false }
        do {
            records = try await APIClient.shared.get("/api/v1/profile/records")
        } catch {
            records = nil
        }
    }

    // MARK: - Fetch calendar (DEV-281)

    func fetchCalendar() async {
        guard !isLoadingCalendar else { return }
        isLoadingCalendar = true
        defer { isLoadingCalendar = false }
        do {
            calendarEntries = try await APIClient.shared.get(
                "/api/v1/profile/calendar",
                query: ["weeks": "5"]
            )
        } catch {
            calendarEntries = []
        }
    }

    // MARK: - Fetch day sessions (DEV-282)

    func fetchDaySessions(date: String) async {
        isLoadingDaySessions = true
        defer { isLoadingDaySessions = false }
        do {
            daySessions = try await APIClient.shared.get(
                "/api/v1/profile/sessions",
                query: ["date": date]
            )
        } catch {
            daySessions = []
        }
    }

    func clearDaySessions() {
        daySessions = []
    }

    // MARK: - Update display name

    func updateDisplayName(_ name: String) async {
        do {
            let updated: ProfileResponse = try await APIClient.shared.patch(
                "/api/v1/profile",
                body: PatchProfileRequest(displayName: name, theme: nil)
            )
            profile = updated
        } catch {
            errorMessage = "Failed to update display name."
        }
    }

    // MARK: - Avatar upload (DEV-284)

    func uploadAvatar(imageData: Data, mimeType: String) async {
        isUploadingAvatar = true
        avatarError       = nil
        defer { isUploadingAvatar = false }

        do {
            // 1. Obtain a presigned S3 PUT URL from the backend
            let presigned: PresignedAvatarResponse = try await APIClient.shared.postEmpty(
                "/api/v1/profile/avatar/presigned"
            )

            // 2. Upload directly to S3 — no auth header needed; presigned URL carries credentials
            guard let s3URL = URL(string: presigned.presignedUrl) else {
                avatarError = "Invalid upload URL."
                return
            }
            var s3Request = URLRequest(url: s3URL)
            s3Request.httpMethod = "PUT"
            s3Request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
            s3Request.httpBody = imageData

            let (_, s3Response) = try await URLSession.shared.data(for: s3Request)
            guard let http = s3Response as? HTTPURLResponse,
                  (200...299).contains(http.statusCode) else {
                avatarError = "Upload failed. Please try again."
                return
            }

            // 3. Refresh profile so avatarUrl propagates across the app
            await fetchProfile()
        } catch {
            avatarError = "Avatar upload failed. Please try again."
        }
    }

    // MARK: - Change password (DEV-285)

    func changePassword(current: String, new: String) async {
        isChangingPassword    = true
        accountError          = nil
        passwordChangeSuccess = false
        defer { isChangingPassword = false }

        do {
            try await APIClient.shared.postBodyVoid(
                "/api/v1/auth/change-password",
                body: ChangePasswordRequest(currentPassword: current, newPassword: new)
            )
            passwordChangeSuccess = true
        } catch let apiErr as APIError {
            switch apiErr {
            case .httpError(400, _): accountError = "New password does not meet requirements."
            case .httpError(401, _): accountError = "Current password is incorrect."
            default: accountError = "Failed to change password. Please try again."
            }
        } catch {
            accountError = "Failed to change password. Please try again."
        }
    }

    // MARK: - Delete account (DEV-285)

    func deleteAccount() async {
        isDeletingAccount = true
        accountError      = nil
        defer { isDeletingAccount = false }

        do {
            try await APIClient.shared.deleteVoid("/api/v1/profile")
            // Clear all persisted state
            Keychain.clearAll()
            UserDefaults.standard.removeObject(forKey: "klondike_user_id")
            onAccountDeleted?()
        } catch {
            accountError = "Failed to delete account. Please try again."
        }
    }
}
