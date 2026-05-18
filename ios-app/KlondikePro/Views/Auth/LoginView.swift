import SwiftUI
import GameKit

/// Authentication screen.
/// Supports email/password and Game Center sign-in.
/// Presented when `AuthStore.isAuthenticated == false`.
struct LoginView: View {

    @Environment(AuthStore.self) private var authStore

    // Tab state
    enum AuthTab { case login, register }
    @State private var tab: AuthTab = .login

    // Form fields
    @State private var email       = ""
    @State private var password    = ""
    @State private var displayName = ""
    @State private var confirmPass = ""

    // Game Center
    @State private var isAuthenticatingGC = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {

                    // ── Logo ─────────────────────────────────────────────
                    VStack(spacing: 8) {
                        Text("🂡")
                            .font(.system(size: 80))
                        Text("Klondike Pro")
                            .font(.largeTitle.bold())
                            .foregroundStyle(.primary)
                        Text("Play anywhere. Continue everywhere.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 48)

                    // ── Tab picker ───────────────────────────────────────
                    Picker("Mode", selection: $tab) {
                        Text("Sign In").tag(AuthTab.login)
                        Text("Register").tag(AuthTab.register)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // ── Form ─────────────────────────────────────────────
                    VStack(spacing: 16) {
                        if tab == .register {
                            FormField(
                                title: "Display name",
                                text: $displayName,
                                keyboard: .default
                            )
                        }

                        FormField(
                            title: "Email",
                            text: $email,
                            keyboard: .emailAddress,
                            contentType: .emailAddress
                        )

                        FormField(
                            title: "Password",
                            text: $password,
                            isSecure: true,
                            contentType: tab == .login ? .password : .newPassword
                        )

                        if tab == .register {
                            FormField(
                                title: "Confirm password",
                                text: $confirmPass,
                                isSecure: true,
                                contentType: .newPassword
                            )
                        }
                    }
                    .padding(.horizontal)

                    // ── Error ─────────────────────────────────────────────
                    if let error = authStore.errorMessage {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.footnote)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                            .accessibilityLabel("Error: \(error)")
                    }

                    // ── Primary action ───────────────────────────────────
                    Button(action: primaryAction) {
                        Group {
                            if authStore.isLoading {
                                ProgressView()
                                    .tint(.black)
                            } else {
                                Text(tab == .login ? "Sign In" : "Create Account")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.yellow)
                    .foregroundStyle(.black)
                    .padding(.horizontal)
                    .disabled(authStore.isLoading || !formIsValid)

                    // ── Divider ───────────────────────────────────────────
                    HStack {
                        Rectangle().frame(height: 1).foregroundStyle(.separator)
                        Text("or").font(.footnote).foregroundStyle(.secondary)
                        Rectangle().frame(height: 1).foregroundStyle(.separator)
                    }
                    .padding(.horizontal)

                    // ── Game Center ───────────────────────────────────────
                    Button(action: signInWithGameCenter) {
                        HStack(spacing: 10) {
                            Image(systemName: "gamecontroller.fill")
                            Text("Continue with Game Center")
                                .fontWeight(.medium)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                    }
                    .buttonStyle(.bordered)
                    .tint(.primary)
                    .padding(.horizontal)
                    .disabled(isAuthenticatingGC || authStore.isLoading)

                    Spacer(minLength: 32)
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationBarHidden(true)
        }
    }

    // MARK: - Actions

    private func primaryAction() {
        Task {
            if tab == .login {
                await authStore.login(email: email, password: password)
            } else {
                guard password == confirmPass else {
                    // Surface mismatch inline — AuthStore error pathway
                    return
                }
                await authStore.register(
                    email: email, password: password, displayName: displayName)
            }
        }
    }

    private func signInWithGameCenter() {
        // DEV-249/250: full GK → ECDSA signature → POST /api/v1/auth/game-center flow.
        // GameCenterService handles the GK auth sheet and signature fetch.
        // AuthStore.loginWithGameCenter() calls the service then POSTs to backend.
        isAuthenticatingGC = true
        Task {
            await authStore.loginWithGameCenter()
            await MainActor.run { isAuthenticatingGC = false }
        }
    }

    // MARK: - Validation

    private var formIsValid: Bool {
        guard !email.isEmpty, !password.isEmpty else { return false }
        if tab == .register {
            return !displayName.isEmpty && password == confirmPass && password.count >= 8
        }
        return true
    }
}

// MARK: - Reusable form field

private struct FormField: View {
    let title: String
    @Binding var text: String
    var isSecure: Bool = false
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)

            Group {
                if isSecure {
                    SecureField("", text: $text)
                } else {
                    TextField("", text: $text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .textContentType(contentType)
            .padding(12)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Color.primary.opacity(0.1), lineWidth: 1)
            )
        }
    }
}
