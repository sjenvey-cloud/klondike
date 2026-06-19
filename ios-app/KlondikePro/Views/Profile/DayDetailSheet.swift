import SwiftUI

/// DEV-282 — Sheet shown when the user taps a day cell in ProfileCalendarView.
///
/// Lists every session played that day (won or lost). Tapping a hand opens
/// HandDetailView with its actions: play the hand, watch the replay, challenge
/// friends, and view the hand's leaderboard (web parity).
struct DayDetailSheet: View {

    let date: String

    @Environment(ProfileStore.self) private var store
    @Environment(\.dismiss)         private var dismiss

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
                                NavigationLink {
                                    HandDetailView(session: session)
                                } label: {
                                    sessionRow(session)
                                }
                                .buttonStyle(.plain)
                                Divider().background(Color.white.opacity(0.08))
                            }
                        }
                        .padding(.top, 8)
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
        .task { await store.fetchDaySessions(date: date) }
    }

    // MARK: - Session row

    private func sessionRow(_ session: ProfileDaySession) -> some View {
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

            Image(systemName: "chevron.right")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.3))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(session.isWon ? "Won" : "Did not finish"): \(session.moves) moves, \(formattedTime(session.timeSeconds)). Tap for hand actions."
        )
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
}
