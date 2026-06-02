import SwiftUI
import PhotosUI

/// DEV-279 — Root of the Profile tab.
///
/// Header: avatar (tappable for upload), display name, gear icon → AccountView.
/// Tabs:   Stats | Calendar | Records | History
struct ProfileView: View {

    @Environment(ProfileStore.self)     private var store
    @Environment(AuthStore.self)        private var authStore
    @Environment(PreferencesStore.self) private var preferencesStore

    @State private var selectedTab: ProfileTab = .stats
    @State private var showAccount             = false
    @State private var showSettings            = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var editingName             = false
    @State private var nameInput               = ""

    enum ProfileTab { case stats, calendar, records, history }

    var body: some View {
        VStack(spacing: 0) {
            header
            tabPicker
            Divider().background(Color.white.opacity(0.12))

            Group {
                switch selectedTab {
                case .stats:    ProfileStatsView()
                case .calendar: ProfileCalendarView()
                case .records:  ProfileRecordsView()
                case .history:  ProfileHistoryView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea())
        .sheet(isPresented: $showAccount) {
            AccountView()
                .environment(store)
                .environment(authStore)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environment(preferencesStore)
                .environment(authStore)
        }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task { await handleAvatarPick(item) }
        }
        .onAppear {
            Task { await store.fetchProfile() }
        }
        .overlay(alignment: .top) {
            if let err = store.avatarError {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.red.opacity(0.85))
                    .clipShape(Capsule())
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: store.avatarError)
    }

    // MARK: - Header (DEV-279 + DEV-284)

    private var header: some View {
        VStack(spacing: 10) {
            HStack(alignment: .top) {
                Spacer()

                // ── Avatar ──────────────────────────────────────────────
                PhotosPicker(
                    selection: $selectedPhoto,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    avatarImage
                }
                .accessibilityLabel("Change profile photo")

                Spacer()

                // ── Settings + Gear buttons ─────────────────────────────
                HStack(spacing: 14) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .accessibilityLabel("App settings")

                    Button {
                        showAccount = true
                    } label: {
                        Image(systemName: "gearshape")
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .accessibilityLabel("Account settings")
                }
                .padding(.trailing, 16)
                .padding(.top, 4)
            }

            // ── Display name ─────────────────────────────────────────────
            if editingName {
                HStack(spacing: 8) {
                    TextField("Display name", text: $nameInput)
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .submitLabel(.done)
                        .onSubmit { saveName() }

                    Button(action: saveName) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.yellow)
                    }
                }
                .padding(.horizontal, 40)
            } else {
                Button {
                    nameInput   = store.profile?.displayName ?? ""
                    editingName = true
                } label: {
                    HStack(spacing: 6) {
                        Text(store.profile?.displayName ?? "—")
                            .font(.title3.bold())
                            .foregroundStyle(.white)
                        Image(systemName: "pencil")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.35))
                    }
                }
                .accessibilityLabel("Edit display name: \(store.profile?.displayName ?? "")")
            }

            // ── Email ────────────────────────────────────────────────────
            if let email = store.profile?.email {
                Text(email)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    // MARK: - Avatar image

    @ViewBuilder
    private var avatarImage: some View {
        ZStack {
            Circle()
                .fill(Color.white.opacity(0.1))
                .frame(width: 72, height: 72)

            if store.isUploadingAvatar {
                ProgressView()
                    .tint(.yellow)
                    .scaleEffect(1.2)
            } else if let urlStr = store.profile?.avatarUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable()
                            .scaledToFill()
                            .frame(width: 72, height: 72)
                            .clipShape(Circle())
                    default:
                        defaultAvatarIcon
                    }
                }
            } else {
                defaultAvatarIcon
            }

            // Camera badge
            if !store.isUploadingAvatar {
                Circle()
                    .fill(Color(red: 0.05, green: 0.07, blue: 0.10))
                    .frame(width: 22, height: 22)
                    .overlay(
                        Image(systemName: "camera.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.white.opacity(0.7))
                    )
                    .offset(x: 24, y: 24)
            }
        }
        .frame(width: 72, height: 72)
    }

    private var defaultAvatarIcon: some View {
        Image(systemName: "person.fill")
            .font(.system(size: 32))
            .foregroundStyle(.white.opacity(0.4))
    }

    // MARK: - Tab picker

    private var tabPicker: some View {
        HStack(spacing: 0) {
            tabButton("Stats",    tab: .stats,    icon: "chart.bar.fill")
            tabButton("Calendar", tab: .calendar, icon: "calendar.badge.clock")
            tabButton("Records",  tab: .records,  icon: "medal.fill")
            tabButton("History",  tab: .history,  icon: "clock.arrow.circlepath")
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .padding(.top, 4)
    }

    private func tabButton(_ label: String, tab: ProfileTab, icon: String) -> some View {
        let active = selectedTab == tab
        return Button {
            selectedTab = tab
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: active ? .semibold : .regular))
                Text(label)
                    .font(.caption.weight(active ? .semibold : .regular))
            }
            .foregroundStyle(active ? Color.yellow : Color.white.opacity(0.45))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }

    // MARK: - Avatar pick handler

    private func handleAvatarPick(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        // Detect JPEG vs PNG by magic bytes
        let mime: String = data.prefix(3) == Data([0xFF, 0xD8, 0xFF]) ? "image/jpeg" : "image/png"
        await store.uploadAvatar(imageData: data, mimeType: mime)
        selectedPhoto = nil
    }

    // MARK: - Save display name

    private func saveName() {
        let trimmed = nameInput.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { editingName = false; return }
        editingName = false
        Task { await store.updateDisplayName(trimmed) }
    }
}

// MARK: - History tab (uses calendar entries as a list)

private struct ProfileHistoryView: View {

    @Environment(ProfileStore.self) private var store

    var body: some View {
        Group {
            if store.isLoadingCalendar && store.calendarEntries.isEmpty {
                VStack { Spacer(); ProgressView().tint(.yellow); Spacer() }

            } else if playedEntries.isEmpty {
                emptyState

            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(playedEntries) { entry in
                            historyRow(entry)
                            Divider().background(Color.white.opacity(0.07))
                        }
                    }
                }
            }
        }
        .task {
            if store.calendarEntries.isEmpty {
                await store.fetchCalendar()
            }
        }
    }

    private var playedEntries: [ProfileCalendarEntry] {
        store.calendarEntries
            .filter { $0.gamesPlayed > 0 }
            .sorted { $0.date > $1.date }
    }

    private func historyRow(_ entry: ProfileCalendarEntry) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(formattedDate(entry.date))
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                Text("\(entry.gamesPlayed) game\(entry.gamesPlayed == 1 ? "" : "s") played")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
            }
            Spacer()
            if entry.gamesWon > 0 {
                Label("\(entry.gamesWon) won", systemImage: "checkmark.seal.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.yellow)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(formattedDate(entry.date)): \(entry.gamesPlayed) played, \(entry.gamesWon) won"
        )
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 44))
                .foregroundStyle(.white.opacity(0.2))
            Text("No games played yet")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.4))
            Spacer()
        }
    }

    private func formattedDate(_ str: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: str) else { return str }
        let out = DateFormatter(); out.dateStyle = .medium
        return out.string(from: d)
    }
}
