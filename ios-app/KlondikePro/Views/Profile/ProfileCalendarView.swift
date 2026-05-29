import SwiftUI

/// DEV-281 — Profile calendar heatmap tab.
///
/// Displays a 5-week rolling grid (35 days ending today).
/// Each cell is shaded by activity level; days with a win show a yellow ring.
/// Tapping a cell with activity opens DayDetailSheet (DEV-282).
struct ProfileCalendarView: View {

    @Environment(ProfileStore.self) private var store
    @State private var selectedDate: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            if store.isLoadingCalendar && store.calendarEntries.isEmpty {
                Spacer()
                ProgressView().tint(.yellow)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 20) {
                        heatmapGrid
                            .padding(.horizontal, 16)
                            .padding(.top, 16)

                        legendRow
                            .padding(.horizontal, 16)

                        summaryCards
                            .padding(.horizontal, 16)

                        Spacer(minLength: 16)
                    }
                }
            }
        }
        .task { await store.fetchCalendar() }
        .sheet(item: Binding<SelectedDay?>(
            get: { selectedDate.map { SelectedDay(date: $0) } },
            set: { if $0 == nil { selectedDate = nil; store.clearDaySessions() } }
        )) { day in
            DayDetailSheet(date: day.date)
                .environment(store)
        }
    }

    // MARK: - Heatmap grid

    private var heatmapGrid: some View {
        VStack(spacing: 6) {
            // Weekday headers: Sun → Sat
            HStack(spacing: 4) {
                ForEach(["S", "M", "T", "W", "T", "F", "S"], id: \.self) { label in
                    Text(label)
                        .font(.caption2.bold())
                        .foregroundStyle(.white.opacity(0.3))
                        .frame(maxWidth: .infinity)
                }
            }

            // 5 weeks × 7 days
            let cells = gridCells()
            ForEach(0..<5, id: \.self) { week in
                HStack(spacing: 4) {
                    ForEach(0..<7, id: \.self) { day in
                        let idx = week * 7 + day
                        if idx < cells.count {
                            heatCell(date: cells[idx])
                        } else {
                            Color.clear.frame(maxWidth: .infinity).frame(height: 40)
                        }
                    }
                }
            }
        }
    }

    private func heatCell(date: String?) -> some View {
        let entry   = date.flatMap { d in store.calendarEntries.first { $0.date == d } }
        let played  = entry?.gamesPlayed ?? 0
        let won     = (entry?.gamesWon ?? 0) > 0
        let isToday = date == todayString()
        let hasPast = date != nil && date! <= todayString()

        return Button {
            guard let d = date, played > 0 else { return }
            selectedDate = d
        } label: {
            RoundedRectangle(cornerRadius: 6)
                .fill(cellFill(played: played, hasPast: hasPast))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .strokeBorder(
                            won ? Color.yellow : (isToday ? Color.white.opacity(0.4) : Color.clear),
                            lineWidth: won ? 2 : 1
                        )
                )
                .frame(maxWidth: .infinity)
                .frame(height: 40)
        }
        .disabled(date == nil || played == 0)
        .accessibilityLabel(accessibilityLabel(date: date, entry: entry))
    }

    private func cellFill(played: Int, hasPast: Bool) -> Color {
        guard hasPast else { return Color.clear }
        switch played {
        case 0:  return Color.white.opacity(0.06)
        case 1:  return Color.yellow.opacity(0.25)
        case 2:  return Color.yellow.opacity(0.45)
        default: return Color.yellow.opacity(0.70)
        }
    }

    private func accessibilityLabel(date: String?, entry: ProfileCalendarEntry?) -> String {
        guard let date else { return "No date" }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let out = DateFormatter(); out.dateStyle = .medium
        let dateLabel = f.date(from: date).map { out.string(from: $0) } ?? date
        guard let entry, entry.gamesPlayed > 0 else { return "\(dateLabel): no games" }
        return "\(dateLabel): \(entry.gamesPlayed) played, \(entry.gamesWon) won"
    }

    // MARK: - Legend

    private var legendRow: some View {
        HStack(spacing: 16) {
            legendItem(color: Color.white.opacity(0.06), label: "0")
            legendItem(color: Color.yellow.opacity(0.25), label: "1")
            legendItem(color: Color.yellow.opacity(0.45), label: "2")
            legendItem(color: Color.yellow.opacity(0.70), label: "3+")
            Spacer()
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 3)
                    .strokeBorder(Color.yellow, lineWidth: 2)
                    .frame(width: 14, height: 14)
                Text("Win")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 3)
                .fill(color)
                .frame(width: 14, height: 14)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.4))
        }
    }

    // MARK: - Summary cards

    private var summaryCards: some View {
        let entries  = store.calendarEntries
        let total    = entries.reduce(0) { $0 + $1.gamesPlayed }
        let wins     = entries.reduce(0) { $0 + $1.gamesWon }
        let activeDays = entries.filter { $0.gamesPlayed > 0 }.count
        let streak   = currentStreak()

        return HStack(spacing: 12) {
            summaryCard(value: "\(activeDays)", label: "Active Days")
            summaryCard(value: "\(total)",      label: "Games")
            summaryCard(value: "\(wins)",        label: "Wins")
            summaryCard(value: "\(streak)🔥",   label: "Streak")
        }
    }

    private func summaryCard(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(.headline, design: .monospaced).bold())
                .foregroundStyle(.white)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }

    // MARK: - Grid helper (35 cells, Sun → Sat, newest row last)

    /// Returns 35 date strings (or nil for padding) in Sun–Sat order,
    /// with today's week at the bottom.
    private func gridCells() -> [String?] {
        let cal      = Calendar.current
        let today    = Date()
        // How many days since Sunday (weekday index 0 = Sunday in our grid)
        let todayWeekday = cal.component(.weekday, from: today) - 1  // 0=Sun … 6=Sat
        // Index in the 35-cell grid where today falls (last full week, last row)
        let todayIdx = 34 - (6 - todayWeekday)

        var cells: [String?] = Array(repeating: nil, count: 35)
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        for i in 0..<35 {
            let offset = i - todayIdx
            if offset <= 0 {
                if let d = cal.date(byAdding: .day, value: offset, to: today) {
                    cells[i] = f.string(from: d)
                }
            }
        }
        return cells
    }

    private func todayString() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }

    // MARK: - Streak

    private func currentStreak() -> Int {
        let played = Set(store.calendarEntries.filter { $0.gamesPlayed > 0 }.map { $0.date })
        let cal    = Calendar.current
        let f      = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        var streak = 0
        var date   = Date()
        while true {
            let str = f.string(from: date)
            if played.contains(str) {
                streak += 1
                date = cal.date(byAdding: .day, value: -1, to: date)!
            } else {
                break
            }
        }
        return streak
    }
}

// MARK: - Helper for sheet binding

private struct SelectedDay: Identifiable {
    let date: String
    var id: String { date }
}
