import SwiftUI

// MARK: - Theme definition

// DEV-337: canonical palette — these hex values match the web (constants/palette.ts).
private struct AppTheme: Identifiable {
    let id: String          // canonical themeName
    let name: String
    let feltHex: String
    let felt: Color
    let accent: Color
}

private let themes: [AppTheme] = [
    AppTheme(id: "dark-premium",   name: "Dark Premium",   feltHex: "#0d1117", felt: Color(hex: "#0d1117"), accent: .yellow),
    AppTheme(id: "classic-felt",   name: "Classic Felt",   feltHex: "#1a5c2e", felt: Color(hex: "#1a5c2e"), accent: .green),
    AppTheme(id: "modern-minimal", name: "Modern Minimal", feltHex: "#2d2d2d", felt: Color(hex: "#2d2d2d"), accent: .white),
]

private struct CardBackOption: Identifiable {
    let id: String   // hex
    let color: Color
}

private let cardBackOptions: [CardBackOption] = [
    CardBackOption(id: "#1c2333", color: Color(hex: "#1c2333")),
    CardBackOption(id: "#2d1b4e", color: Color(hex: "#2d1b4e")),
    CardBackOption(id: "#1a3a2e", color: Color(hex: "#1a3a2e")),
    CardBackOption(id: "#3a1a1a", color: Color(hex: "#3a1a1a")),
    CardBackOption(id: "#1a2a3a", color: Color(hex: "#1a2a3a")),
    CardBackOption(id: "#2a2a2a", color: Color(hex: "#2a2a2a")),
]

// MARK: - SettingsView (DEV-287)

/// Full settings screen: theme, card back, gameplay, animations, accessibility.
/// Each change is immediately PATCHed to /api/v1/profile/preferences via PreferencesStore.
struct SettingsView: View {

    @Environment(PreferencesStore.self) private var store
    @Environment(AuthStore.self)        private var authStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion  // DEV-292
    @Environment(\.dismiss) private var dismiss

    @State private var showSignOutAlert = false

    // DEV-314: daily reminder local state, seeded from preferences on appear.
    @State private var reminderEnabled = false
    @State private var reminderTime    = Self.defaultReminderTime()

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        themeSection         // DEV-288
                        cardBackSection      // DEV-289
                        gameplaySection      // DEV-290
                        animationSection     // DEV-291
                        reminderSection      // DEV-314
                        accessibilitySection // DEV-292
                        accountSection       // DEV-332
                        signOutSection
                    }
                    .padding(16)
                }
            }
            .onAppear { seedReminderState() }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(.yellow)
                }
            }
        }
    }

    // MARK: - Theme (DEV-288)

    private var themeSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Appearance", icon: "paintbrush.fill")

            Text("Theme")
                .font(.subheadline.bold())
                .foregroundStyle(.white)

            HStack(spacing: 12) {
                ForEach(themes) { theme in
                    // Highlight by canonical theme name (falls back to felt-hex match for
                    // older rows where themeName isn't set yet).
                    let selected = store.preferences.themeName == theme.id
                        || (store.preferences.themeName == nil && store.preferences.feltColour == theme.feltHex)
                    Button {
                        Task { await store.setTheme(name: theme.id, felt: theme.feltHex) }
                    } label: {
                        VStack(spacing: 8) {
                            // Mini board preview
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(theme.felt)
                                    .frame(height: 54)
                                HStack(spacing: 4) {
                                    ForEach(0..<3) { _ in
                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(Color.white.opacity(0.85))
                                            .frame(width: 16, height: 22)
                                    }
                                }
                            }
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .strokeBorder(
                                        selected ? theme.accent : Color.white.opacity(0.15),
                                        lineWidth: selected ? 2 : 1
                                    )
                            )

                            Text(theme.name)
                                .font(.caption2)
                                .foregroundStyle(selected ? theme.accent : .white.opacity(0.55))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel("Theme: \(theme.name)")
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Card Back (DEV-289)

    private var cardBackSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Card Back")
                .font(.subheadline.bold())
                .foregroundStyle(.white)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 6), spacing: 10) {
                ForEach(cardBackOptions) { option in
                    let selected = store.preferences.cardBackColour == option.id
                    Button {
                        Task { await store.setCardBackColour(option.id) }
                    } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(option.color)
                                .aspectRatio(0.7, contentMode: .fit)
                            RoundedRectangle(cornerRadius: 6)
                                .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                                .padding(3)
                        }
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .strokeBorder(selected ? Color.yellow : Color.clear, lineWidth: 2)
                        )
                    }
                    .accessibilityLabel("Card back colour \(option.id)")
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Gameplay (DEV-290)

    private var gameplaySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Gameplay", icon: "gamecontroller.fill")

            // Draw mode default
            settingsRow(label: "Default Draw Mode") {
                pillPicker(
                    options: [("Draw 1", "draw1"), ("Draw 3", "draw3")],
                    selected: store.preferences.drawModeDefault
                ) { value in
                    Task { await store.setDrawModeDefault(value) }
                }
            }

            Divider().background(Color.white.opacity(0.08))

            // Stock side
            settingsRow(label: "Stock Side") {
                pillPicker(
                    options: [("Left", "left"), ("Right", "right")],
                    selected: store.preferences.stockSide
                ) { value in
                    Task { await store.setStockSide(value) }
                }
            }

            Divider().background(Color.white.opacity(0.08))

            // Animation speed
            settingsRow(label: "Animation Speed") {
                pillPicker(
                    options: [("Slow", "slow"), ("Normal", "normal"), ("Fast", "fast")],
                    selected: store.preferences.animationSpeed
                ) { value in
                    Task { await store.setAnimationSpeed(value) }
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Animation / Win preference (DEV-291)

    private var animationSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Win Animation", icon: "party.popper.fill")

            HStack(spacing: 12) {
                winAnimOption(
                    id: "confetti",
                    icon: "sparkles",
                    label: "Confetti",
                    description: "Full particle show"
                )
                winAnimOption(
                    id: "simple",
                    icon: "checkmark.circle.fill",
                    label: "Simple",
                    description: "Clean & minimal"
                )
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func winAnimOption(id: String, icon: String, label: String, description: String) -> some View {
        let selected = store.preferences.winAnimation == id
        return Button {
            Task { await store.setWinAnimation(id) }
        } label: {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 28))
                    .foregroundStyle(selected ? .yellow : .white.opacity(0.4))
                Text(label)
                    .font(.subheadline.bold())
                    .foregroundStyle(selected ? .yellow : .white.opacity(0.7))
                Text(description)
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(14)
            .background(selected ? Color.yellow.opacity(0.1) : Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(selected ? Color.yellow.opacity(0.5) : Color.clear, lineWidth: 1)
            )
        }
        .accessibilityLabel("Win animation: \(label)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - Daily reminder (DEV-314)

    private var reminderSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Daily Reminder", icon: "bell.badge")

            Toggle(isOn: Binding(
                get: { reminderEnabled },
                set: { newValue in
                    reminderEnabled = newValue
                    Task { await store.setDailyReminder(enabled: newValue, time: Self.hhmm(from: reminderTime)) }
                }
            )) {
                Text("Remind me to play")
                    .font(.subheadline)
                    .foregroundStyle(.white)
            }
            .tint(.yellow)

            if reminderEnabled {
                Divider().background(Color.white.opacity(0.08))
                DatePicker(
                    "Reminder time",
                    selection: Binding(
                        get: { reminderTime },
                        set: { newDate in
                            reminderTime = newDate
                            Task { await store.setDailyReminder(enabled: true, time: Self.hhmm(from: newDate)) }
                        }
                    ),
                    displayedComponents: .hourAndMinute
                )
                .font(.subheadline)
                .foregroundStyle(.white)
                .tint(.yellow)

                Text("A notification will nudge you at this time each day.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    /// Seed the toggle + picker from the stored preference when the sheet opens.
    private func seedReminderState() {
        if let raw = store.preferences.dailyReminderTime, !raw.isEmpty {
            reminderEnabled = true
            reminderTime = Self.date(fromHHmmss: raw) ?? Self.defaultReminderTime()
        } else {
            reminderEnabled = false
        }
    }

    // MARK: - Reminder time helpers

    private static func defaultReminderTime() -> Date {
        Calendar.current.date(bySettingHour: 19, minute: 0, second: 0, of: Date()) ?? Date()
    }

    /// Formats a Date as "HH:mm" for sending to the backend.
    private static func hhmm(from date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }

    /// Parses a backend "HH:mm:ss" (or "HH:mm") string into today's Date for the picker.
    private static func date(fromHHmmss raw: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        let parts = raw.split(separator: ":")
        guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: Date())
    }

    // MARK: - Accessibility (DEV-292)

    private var accessibilitySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("Accessibility", icon: "figure.wave")

            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Reduce Motion")
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    Text(reduceMotion
                         ? "Enabled — controlled by iOS Settings"
                         : "Off — change in iOS Settings → Accessibility")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.45))
                }
                Spacer()
                Image(systemName: reduceMotion ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(reduceMotion ? .green : .white.opacity(0.3))
                    .font(.title3)
            }

            if reduceMotion {
                Label("Animations are suppressed throughout the app.", systemImage: "info.circle")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Account / Game Center (DEV-332)

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Account", icon: "person.circle.fill")

            // ── Game Center link row ─────────────────────────────────────
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

    // MARK: - Shared helpers

    private func sectionHeader(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.headline)
            .foregroundStyle(.white)
    }

    private func settingsRow<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))
            content()
        }
    }

    private func pillPicker(
        options: [(String, String)],
        selected: String,
        onSelect: @escaping (String) -> Void
    ) -> some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.1) { label, value in
                let active = selected == value
                Button { onSelect(value) } label: {
                    Text(label)
                        .font(.caption.weight(active ? .bold : .regular))
                        .foregroundStyle(active ? .black : .white.opacity(0.7))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(active ? Color.yellow : Color.white.opacity(0.1))
                        .clipShape(Capsule())
                }
                .accessibilityLabel(label)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
            Spacer()
        }
    }
}
