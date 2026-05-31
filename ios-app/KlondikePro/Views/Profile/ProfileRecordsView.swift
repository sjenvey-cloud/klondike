import SwiftUI

/// DEV-283 — Records tab inside ProfileView.
///
/// Shows personal bests: fewest moves and fastest time, each with date.
/// Data from GET /api/v1/profile/records → RecordsResponse.
struct ProfileRecordsView: View {

    @Environment(ProfileStore.self) private var store

    var body: some View {
        Group {
            if store.isLoadingRecords && store.records == nil {
                VStack { Spacer(); ProgressView().tint(.yellow); Spacer() }

            } else if let records = store.records,
                      records.fewestMoves != nil || records.fastestTime != nil {
                ScrollView {
                    VStack(spacing: 16) {
                        // PersonalBest — uses sessionUuid/handUuid (UUIDs), completedAt optional Date
                        if let best = records.fewestMoves {
                            recordCard(
                                title:     "Fewest Moves",
                                icon:      "figure.run",
                                primary:   "\(best.moves) moves",
                                secondary: formattedTime(best.timeSeconds),
                                drawMode:  best.drawMode,
                                date:      best.completedAt
                            )
                        }
                        if let fast = records.fastestTime {
                            recordCard(
                                title:     "Fastest Time",
                                icon:      "stopwatch.fill",
                                primary:   formattedTime(fast.timeSeconds),
                                secondary: "\(fast.moves) moves",
                                drawMode:  fast.drawMode,
                                date:      fast.completedAt
                            )
                        }
                    }
                    .padding(16)
                }

            } else {
                emptyState
            }
        }
        .task { await store.fetchRecords() }
    }

    // MARK: - Record card

    private func recordCard(
        title: String,
        icon: String,
        primary: String,
        secondary: String,
        drawMode: String,
        date: Date?
    ) -> some View {
        HStack(spacing: 16) {
            // Icon
            ZStack {
                Circle()
                    .fill(Color.yellow.opacity(0.15))
                    .frame(width: 52, height: 52)
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundStyle(.yellow)
            }

            // Values
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption.bold())
                    .foregroundStyle(.white.opacity(0.5))
                    .textCase(.uppercase)

                Text(primary)
                    .font(.system(.title3, design: .monospaced).bold())
                    .foregroundStyle(.white)

                HStack(spacing: 8) {
                    Text(secondary)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.5))
                    Text("·")
                        .foregroundStyle(.white.opacity(0.3))
                    Text(drawMode == "draw1" ? "Draw 1" : "Draw 3")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.4))
                }
            }

            Spacer()

            // Date
            if let date {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(formattedDate(date))
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.35))
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(title): \(primary), \(secondary), \(drawMode == "draw1" ? "Draw 1" : "Draw 3")"
        )
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "medal")
                .font(.system(size: 44))
                .foregroundStyle(.white.opacity(0.2))
            Text("No records yet")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.4))
            Text("Win your first game to set a personal best.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.25))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Spacer()
        }
    }

    // MARK: - Helpers

    private func formattedTime(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private func formattedDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f.string(from: date)
    }
}
