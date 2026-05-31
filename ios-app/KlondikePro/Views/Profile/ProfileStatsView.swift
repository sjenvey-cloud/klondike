import SwiftUI

/// DEV-280 — Stats tab inside ProfileView.
///
/// Shows win rate, average moves, and average time broken down by draw mode.
/// Data from GET /api/v1/profile/stats → StatsResponse.
struct ProfileStatsView: View {

    @Environment(ProfileStore.self) private var store

    var body: some View {
        Group {
            if store.isLoadingStats && store.stats == nil {
                VStack { Spacer(); ProgressView().tint(.yellow); Spacer() }

            } else if let stats = store.stats, !stats.byDrawMode.isEmpty {
                ScrollView {
                    VStack(spacing: 16) {
                        ForEach(stats.byDrawMode, id: \.drawMode) { row in
                            drawModeCard(row)   // LabelledStats — drawMode injected for display
                        }
                    }
                    .padding(16)
                }

            } else {
                emptyState
            }
        }
        .task { await store.fetchStats() }
    }

    // MARK: - Draw mode card

    private func drawModeCard(_ row: StatsResponse.LabelledStats) -> some View {
        VStack(spacing: 14) {
            // Mode header
            HStack {
                Text(modeLabel(row.drawMode))
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text("\(row.gamesPlayed) game\(row.gamesPlayed == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.45))
            }

            // Win rate bar
            VStack(spacing: 6) {
                HStack {
                    Text("Win Rate")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.5))
                    Spacer()
                    Text(String(format: "%.0f%%", row.winRate * 100))
                        .font(.caption.bold())
                        .foregroundStyle(winRateColor(row.winRate))
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.white.opacity(0.08))
                        RoundedRectangle(cornerRadius: 3)
                            .fill(winRateColor(row.winRate))
                            .frame(width: geo.size.width * min(CGFloat(row.winRate), 1.0))
                    }
                }
                .frame(height: 6)
            }

            // Avg stats row
            HStack(spacing: 0) {
                statCell(
                    value: String(format: "%.0f", row.avgMoves),
                    label: "Avg Moves"
                )
                Divider()
                    .background(Color.white.opacity(0.12))
                    .frame(height: 36)
                statCell(
                    value: formattedTime(row.avgTimeSeconds),
                    label: "Avg Time"
                )
                Divider()
                    .background(Color.white.opacity(0.12))
                    .frame(height: 36)
                statCell(
                    value: "\(row.wins)",
                    label: "Wins"
                )
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(modeLabel(row.drawMode)): \(row.gamesPlayed) games, " +
            "\(String(format: "%.0f%%", row.winRate * 100)) win rate, " +
            "\(String(format: "%.0f", row.avgMoves)) average moves"
        )
    }

    private func statCell(value: String, label: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(.subheadline, design: .monospaced).bold())
                .foregroundStyle(.white)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "chart.bar")
                .font(.system(size: 44))
                .foregroundStyle(.white.opacity(0.2))
            Text("No stats yet")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.4))
            Text("Play some games to see your stats here.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.25))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Spacer()
        }
    }

    // MARK: - Helpers

    private func modeLabel(_ mode: String) -> String {
        mode == "draw1" ? "Draw 1" : "Draw 3"
    }

    private func winRateColor(_ rate: Double) -> Color {
        if rate >= 0.5 { return .yellow }
        if rate >= 0.25 { return Color.yellow.opacity(0.6) }
        return Color.white.opacity(0.3)
    }

    private func formattedTime(_ seconds: Double) -> String {
        let s = Int(seconds)
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}
