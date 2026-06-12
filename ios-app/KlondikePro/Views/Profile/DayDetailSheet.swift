import SwiftUI

/// DEV-282 — Sheet shown when the user taps a day cell in ProfileCalendarView.
///
/// Displays:
///   • Formatted date header
///   • Session list (from GET /api/v1/profile/sessions?date=...)
///   • "Challenge Friends" button (available Sprint iOS-8)
struct DayDetailSheet: View {

    let date: String

    @Environment(ProfileStore.self) private var store
    @Environment(FriendsStore.self) private var friendsStore
    @Environment(\.dismiss)         private var dismiss

    /// The won session the user has selected to challenge friends on (DEV-344).
    @State private var selectedSessionUuid: UUID?
    @State private var showCompose       = false
    @State private var didSendChallenge  = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

                if store.isLoadingDaySessions {
                    ProgressView()
                        .tint(.yellow)
                        .scaleEffect(1.3)

                } else if store.daySessions.isEmpty {
                    emptyState

                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(store.daySessions) { session in
                                Button {
                                    guard session.isWon else { return }
                                    // Tap to select; tap again to deselect.
                                    selectedSessionUuid =
                                        (selectedSessionUuid == session.uuid) ? nil : session.uuid
                                    didSendChallenge = false
                                } label: {
                                    sessionRow(session, isSelected: selectedSessionUuid == session.uuid)
                                }
                                .buttonStyle(.plain)
                                .disabled(!session.isWon)
                                Divider().background(Color.white.opacity(0.08))
                            }
                        }
                        .padding(.top, 8)

                        // ── Challenge Friends (Sprint iOS-8) ──────────────
                        challengeSection
                            .padding(16)
                    }
                }
            }
            .navigationTitle(formattedDate(date))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(.yellow)
                }
            }
        }
        .task {
            await store.fetchDaySessions(date: date)
            // Convenience: if there's exactly one won hand, pre-select it so the
            // challenge button is immediately usable (DEV-344).
            let won = store.daySessions.filter { $0.isWon }
            if won.count == 1 { selectedSessionUuid = won.first?.uuid }
        }
        .sheet(isPresented: $showCompose) {
            if let uuid = selectedSessionUuid {
                ChallengeComposeSheet(sessionUuid: uuid) { didSendChallenge = true }
                    .environment(friendsStore)
            }
        }
    }

    // MARK: - Session row

    private func sessionRow(_ session: ProfileDaySession, isSelected: Bool) -> some View {
        HStack(spacing: 14) {
            // Win/loss indicator
            ZStack {
                Circle()
                    .fill(session.isWon ? Color.yellow.opacity(0.15) : Color.white.opacity(0.06))
                    .frame(width: 40, height: 40)
                Image(systemName: session.isWon ? "checkmark.seal.fill" : "xmark.seal")
                    .font(.system(size: 18))
                    .foregroundStyle(session.isWon ? .yellow : .white.opacity(0.3))
            }

            // Stats
            VStack(alignment: .leading, spacing: 4) {
                Text(session.isWon ? "Won" : "Did not finish")
                    .font(.subheadline.bold())
                    .foregroundStyle(session.isWon ? .white : .white.opacity(0.5))
                HStack(spacing: 8) {
                    Text("\(session.moves) moves")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.5))
                    Text("·")
                        .foregroundStyle(.white.opacity(0.3))
                    Text(formattedTime(session.timeSeconds))
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.5))
                    Text("·")
                        .foregroundStyle(.white.opacity(0.3))
                    Text(session.drawMode == "draw1" ? "Draw 1" : "Draw 3")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.4))
                }
            }

            Spacer()

            // Completion time
            if let completedAt = session.completedAt {
                Text(formattedTime(of: completedAt))
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.3))
            }

            // Selection indicator — only won hands can be challenged (DEV-344)
            if session.isWon {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? .yellow : .white.opacity(0.25))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(isSelected ? Color.yellow.opacity(0.08) : Color.clear)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(session.isWon ? "Won" : "Did not finish"): \(session.moves) moves, \(formattedTime(session.timeSeconds))"
            + (session.isWon ? (isSelected ? ", selected" : ", tap to select for a challenge") : "")
        )
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - Challenge Friends (Sprint iOS-8 placeholder)

    private var challengeSection: some View {
        let hasWonHand = store.daySessions.contains { $0.isWon }

        return VStack(spacing: 12) {
            Divider().background(Color.white.opacity(0.1))
                .padding(.bottom, 4)

            if didSendChallenge {
                Label("Challenge sent!", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.bold())
                    .foregroundStyle(.green)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
            } else {
                Button {
                    if selectedSessionUuid != nil { showCompose = true }
                } label: {
                    Label("Challenge Friends on This Hand", systemImage: "person.2.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                }
                .buttonStyle(.borderedProminent)
                .tint(.yellow)
                .foregroundStyle(.black)
                .disabled(selectedSessionUuid == nil)

                Text(hasWonHand
                     ? (selectedSessionUuid == nil
                        ? "Select a won hand above, then choose who to challenge."
                        : "Pick friends and/or leagues to challenge on the next screen.")
                     : "Win a hand on this day to challenge your friends.")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.35))
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 40))
                .foregroundStyle(.white.opacity(0.2))
            Text("No sessions found for this day.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    private func formattedDate(_ str: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: str) else { return str }
        let out = DateFormatter(); out.dateStyle = .long
        return out.string(from: d)
    }

    private func formattedTime(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private func formattedTime(of date: Date) -> String {
        let f = DateFormatter(); f.timeStyle = .short
        return f.string(from: date)
    }
}

// MARK: - Challenge compose (DEV-344)

/// Pick friends and/or leagues to challenge on a won hand, then send — mirroring
/// the web flow (select a hand → choose friends/leagues → send). Both selections
/// are sent (possibly empty) so the backend uses the explicit-invite path.
private struct ChallengeComposeSheet: View {

    let sessionUuid: UUID
    var onSent: () -> Void

    @Environment(FriendsStore.self) private var store
    @Environment(\.dismiss)         private var dismiss

    @State private var selectedFriendIds: Set<Int> = []
    @State private var selectedLeagueIds: Set<Int> = []
    @State private var isSending = false
    @State private var loaded    = false

    private var canSend: Bool {
        !isSending && (!selectedFriendIds.isEmpty || !selectedLeagueIds.isEmpty)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

                if !loaded {
                    ProgressView().tint(.yellow).scaleEffect(1.2)
                } else if store.friends.isEmpty && store.customLeagues.isEmpty {
                    emptyState
                } else {
                    List {
                        if !store.friends.isEmpty {
                            Section("Friends") {
                                ForEach(store.friends) { friend in
                                    row(title: friend.displayName,
                                        subtitle: nil,
                                        isOn: selectedFriendIds.contains(friend.userId)) {
                                        if selectedFriendIds.contains(friend.userId) {
                                            selectedFriendIds.remove(friend.userId)
                                        } else {
                                            selectedFriendIds.insert(friend.userId)
                                        }
                                    }
                                }
                            }
                        }
                        if !store.customLeagues.isEmpty {
                            Section("Leagues") {
                                ForEach(store.customLeagues) { league in
                                    row(title: league.name,
                                        subtitle: "\(league.memberCount) member\(league.memberCount == 1 ? "" : "s")",
                                        isOn: selectedLeagueIds.contains(league.id)) {
                                        if selectedLeagueIds.contains(league.id) {
                                            selectedLeagueIds.remove(league.id)
                                        } else {
                                            selectedLeagueIds.insert(league.id)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Challenge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(.yellow)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task {
                            isSending = true
                            let ok = await store.createChallenge(
                                fromSessionUuid: sessionUuid,
                                invitedUserIds: Array(selectedFriendIds),
                                invitedLeagueIds: Array(selectedLeagueIds)
                            )
                            isSending = false
                            if ok { onSent(); dismiss() }
                        }
                    } label: {
                        if isSending {
                            ProgressView().tint(.yellow)
                        } else {
                            Text("Send").bold()
                        }
                    }
                    .foregroundStyle(canSend ? .yellow : .gray)
                    .disabled(!canSend)
                }
            }
            .task {
                await store.fetchFriends()
                await store.fetchCustomLeagues()
                loaded = true
            }
        }
    }

    private func row(title: String, subtitle: String?, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).foregroundStyle(.white)
                    if let subtitle {
                        Text(subtitle).font(.caption).foregroundStyle(.white.opacity(0.5))
                    }
                }
                Spacer()
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isOn ? .yellow : .white.opacity(0.3))
            }
        }
        .listRowBackground(Color.white.opacity(0.04))
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 40)).foregroundStyle(.white.opacity(0.2))
            Text("No friends or leagues yet")
                .font(.subheadline).foregroundStyle(.white.opacity(0.5))
            Text("Add friends or create a league in the Social tab first.")
                .font(.caption).foregroundStyle(.white.opacity(0.35))
                .multilineTextAlignment(.center).padding(.horizontal, 32)
        }
    }
}
