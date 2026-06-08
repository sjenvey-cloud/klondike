import SwiftUI

/// DEV-285 — Account management sheet opened from the gear icon in ProfileView.
///
/// Sections:
///   • Change password (current + new + confirm)
///   • Danger zone: Delete account with confirmation alert
struct AccountView: View {

    @Environment(ProfileStore.self) private var store
    @Environment(AuthStore.self)    private var authStore
    @Environment(\.dismiss)         private var dismiss

    // Change password fields
    @State private var currentPassword = ""
    @State private var newPassword     = ""
    @State private var confirmPassword = ""
    @State private var showPasswords   = false

    // Delete account — requires password confirmation
    @State private var showDeleteConfirm  = false
    @State private var deletePassword     = ""

    // Sign out confirmation
    @State private var showSignOutAlert   = false

    // Local validation
    private var passwordMismatch: Bool { !newPassword.isEmpty && newPassword != confirmPassword }
    private var canSubmitPassword: Bool {
        !currentPassword.isEmpty &&
        newPassword.count >= 8 &&
        newPassword == confirmPassword &&
        !store.isChangingPassword
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        changePasswordSection
                        gameCenterSection   // DEV-332 (moved from appearance settings)
                        signOutSection
                        dangerZoneSection
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(.yellow)
                }
            }
            .alert("Delete Account", isPresented: $showDeleteConfirm) {
                SecureField("Your password", text: $deletePassword)
                Button("Delete", role: .destructive) {
                    let pw = deletePassword
                    deletePassword = ""
                    Task { await store.deleteAccount(password: pw) }
                }
                .disabled(deletePassword.isEmpty)
                Button("Cancel", role: .cancel) { deletePassword = "" }
            } message: {
                Text("Enter your password to permanently delete your account and all game history. This cannot be undone.")
            }
            .onChange(of: store.passwordChangeSuccess) { _, success in
                if success {
                    currentPassword = ""
                    newPassword     = ""
                    confirmPassword = ""
                }
            }
        }
        .onAppear {
            // Wire the delete callback so AuthStore can log out
            store.onAccountDeleted = {
                Task { await authStore.logout() }
                dismiss()
            }
        }
    }

    // MARK: - Change password

    private var changePasswordSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Change Password", icon: "lock.fill")

            // Success banner
            if store.passwordChangeSuccess {
                Label("Password updated successfully.", systemImage: "checkmark.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(.green)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.green.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            // Error banner
            if let err = store.accountError {
                Label(err, systemImage: "exclamationmark.circle")
                    .font(.subheadline)
                    .foregroundStyle(.red)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.red.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            VStack(spacing: 10) {
                secureField("Current password", text: $currentPassword)
                secureField("New password (8+ characters)", text: $newPassword)
                secureField("Confirm new password", text: $confirmPassword)

                if passwordMismatch {
                    Text("Passwords don't match.")
                        .font(.caption)
                        .foregroundStyle(.red.opacity(0.8))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, 4)
                }
            }

            Button {
                Task {
                    store.accountError          = nil
                    store.passwordChangeSuccess = false
                    await store.changePassword(current: currentPassword, new: newPassword)
                }
            } label: {
                Group {
                    if store.isChangingPassword {
                        ProgressView().tint(.black)
                    } else {
                        Text("Update Password")
                            .font(.headline)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(.yellow)
            .foregroundStyle(.black)
            .disabled(!canSubmitPassword)
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Danger zone

    private var dangerZoneSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Danger Zone", icon: "exclamationmark.triangle.fill")

            Text("Deleting your account is permanent and cannot be undone. All game history, stats, and records will be lost.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.5))

            Button {
                showDeleteConfirm = true
            } label: {
                Group {
                    if store.isDeletingAccount {
                        ProgressView().tint(.white)
                    } else {
                        Label("Delete Account", systemImage: "trash.fill")
                            .font(.headline)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
            }
            .buttonStyle(.bordered)
            .tint(.red)
            .foregroundStyle(.red)
            .disabled(store.isDeletingAccount)
        }
        .padding(16)
        .background(Color.red.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(Color.red.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Game Center link (DEV-332)

    private var gameCenterSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Game Center", icon: "person.circle.fill")

            HStack(spacing: 12) {
                Image(systemName: "gamecontroller.fill")
                    .font(.subheadline)
                    .foregroundStyle(authStore.isGameCenterLinked ? .green : .white.opacity(0.35))
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Game Center")
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    Text(authStore.isGameCenterLinked
                         ? "Linked — friends can find you in-game"
                         : "Not linked — connect to enable social features")
                        .font(.caption)
                        .foregroundStyle(authStore.isGameCenterLinked
                                         ? Color.green.opacity(0.8)
                                         : Color.white.opacity(0.4))
                }

                Spacer()

                if authStore.isGameCenterLinked {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.title3)
                } else if authStore.isLinkingGameCenter {
                    ProgressView().tint(.yellow)
                } else {
                    Button("Link") {
                        Task { await authStore.linkGameCenter() }
                    }
                    .font(.caption.bold())
                    .foregroundStyle(.yellow)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Color.yellow.opacity(0.12))
                    .clipShape(Capsule())
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(
                authStore.isGameCenterLinked
                    ? "Game Center: linked"
                    : "Game Center: not linked. Activate to link."
            )

            if let err = authStore.gameCenterLinkError {
                Label(err, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.red.opacity(0.8))
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Sign Out

    private var signOutSection: some View {
        Button {
            showSignOutAlert = true
        } label: {
            HStack {
                Spacer()
                Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    .font(.subheadline.bold())
                    .foregroundStyle(.red)
                Spacer()
            }
            .padding(.vertical, 16)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .accessibilityLabel("Sign out of Klondike Pro")
        .alert("Sign Out?", isPresented: $showSignOutAlert) {
            Button("Sign Out", role: .destructive) {
                Task { await authStore.logout() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You'll need to sign in again to continue playing.")
        }
    }

    // MARK: - Helpers

    private func sectionHeader(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.headline)
            .foregroundStyle(.white)
    }

    private func secureField(_ placeholder: String, text: Binding<String>) -> some View {
        Group {
            if showPasswords {
                TextField(placeholder, text: text)
            } else {
                SecureField(placeholder, text: text)
            }
        }
        .textContentType(.password)
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
        .padding(12)
        .background(Color.white.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .foregroundStyle(.white)
        .overlay(alignment: .trailing) {
            Button {
                showPasswords.toggle()
            } label: {
                Image(systemName: showPasswords ? "eye.slash" : "eye")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.4))
                    .padding(.trailing, 12)
            }
        }
    }
}
