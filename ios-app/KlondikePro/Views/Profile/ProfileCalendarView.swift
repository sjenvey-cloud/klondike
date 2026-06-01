import SwiftUI

/// DEV-281 — Profile calendar tab.
///
/// Shows a monthly calendar grid with:
///   • Month / year header with prev / next navigation arrows
///   • Day-of-week column headers (S M T W T F S)
///   • Date numbers inside each cell
///   • Activity shading by games played (empty → 3+ shades of yellow)
///   • Yellow border ring on days with at least one win
///   • "Today" shown with a white border
///   • Days outside the current month shown dimmed / empty
///   • Tapping an active day opens DayDetailSheet
///
/// Backend data: GET /api/v1/profile/calendar?weeks=26 (≈6 months backward).
/// Oldest navigable month = 6 months ago.
struct ProfileCalendarView: View {

    @Environment(ProfileStore.self) private var store
    @State private var selectedDate: String? = nil

    /// First day of the month currently shown.
    @State private var displayMonth: Date = Self.firstDayOfCurrentMonth()

    // Fast O(1) lookup by "yyyy-MM-dd" key
    private var entryByDate: [String: ProfileCalendarEntry] {
        Dictionary(uniqueKeysWithValues: store.calendarEntries.map { ($0.date, $0) })
    }

    private var todayString: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }

    // Navigation limits
    private var earliestMonth: Date { Self.firstDayOfMonth(monthsAgo: 6) }
    private var canGoPrevious: Bool { displayMonth > earliestMonth }
    private var canGoNext:     Bool { displayMonth < Self.firstDayOfCurrentMonth() }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            if store.isLoadingCalendar && store.calendarEntries.isEmpty {
                Spacer()
                ProgressView().tint(.yellow)
                Spacer()
            } else {
                ScrollView {
                    VStack(spacing: 20) {
                        VStack(spacing: 12) {
                            monthNavHeader
                            weekdayHeader
                            calendarGrid
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 12)

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

    // MARK: - Month navigation header

    private var monthNavHeader: some View {
        HStack {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    displayMonth = Self.monthOffset(from: displayMonth, by: -1)
                }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.title3.bold())
                    .foregroundStyle(canGoPrevious ? .white : .white.opacity(0.2))
            }
            .disabled(!canGoPrevious)
            .accessibilityLabel("Previous month")

            Spacer()

            Text(monthYearString(displayMonth))
                .font(.headline)
                .foregroundStyle(.white)
                .accessibilityLabel(monthYearString(displayMonth))

            Spacer()

            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    displayMonth = Self.monthOffset(from: displayMonth, by: +1)
                }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.title3.bold())
                    .foregroundStyle(canGoNext ? .white : .white.opacity(0.2))
            }
            .disabled(!canGoNext)
            .accessibilityLabel("Next month")
        }
    }

    // MARK: - Weekday header row

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], id: \.self) { label in
                Text(label)
                    .font(.caption2.bold())
                    .foregroundStyle(.white.opacity(0.35))
                    .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Calendar grid (6 rows × 7 cols)

    private var calendarGrid: some View {
        let cells = monthGridCells()

        return VStack(spacing: 4) {
            ForEach(0..<6, id: \.self) { row in
                HStack(spacing: 4) {
                    ForEach(0..<7, id: \.self) { col in
                        let idx = row * 7 + col
                        if idx < cells.count {
                            dayCell(info: cells[idx])
                        }
                    }
                }
            }
        }
    }

    // MARK: - Day cell

    private func dayCell(info: DayCellInfo) -> some View {
        let entry    = info.dateString.flatMap { entryByDate[$0] }
        let played   = entry?.gamesPlayed ?? 0
        let hasWin   = (entry?.gamesWon ?? 0) > 0
        let isToday  = info.dateString == todayString
        let inMonth  = info.inCurrentMonth

        return Button {
            guard let d = info.dateString, played > 0 else { return }
            selectedDate = d
        } label: {
            ZStack {
                // Background fill
                RoundedRectangle(cornerRadius: 7)
                    .fill(cellFill(played: played, inMonth: inMonth, isPast: info.isPast))

                // Border: win = yellow, today = white dim, else none
                RoundedRectangle(cornerRadius: 7)
                    .strokeBorder(
                        hasWin ? Color.yellow :
                            (isToday && inMonth ? Color.white.opacity(0.55) : Color.clear),
                        lineWidth: hasWin ? 2 : 1
                    )

                // Date number
                VStack {
                    HStack {
                        Spacer()
                        if let ds = info.dateString {
                            Text(dayNumber(from: ds))
                                .font(.caption2.monospacedDigit().weight(isToday ? .bold : .regular))
                                .foregroundStyle(
                                    !inMonth      ? .white.opacity(0.18) :
                                    isToday       ? .white :
                                    played > 0    ? .white.opacity(0.9) :
                                                    .white.opacity(0.35)
                                )
                        }
                    }
                    .padding(.top, 4)
                    .padding(.trailing, 5)
                    Spacer()
                }

                // Win dot indicator (small yellow dot below the number)
                if hasWin && inMonth {
                    VStack {
                        Spacer()
                        Circle()
                            .fill(Color.yellow)
                            .frame(width: 4, height: 4)
                            .padding(.bottom, 5)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
        }
        .disabled(info.dateString == nil || played == 0 || !info.isPast)
        .accessibilityLabel(cellAccessibilityLabel(info: info, entry: entry))
    }

    private func cellFill(played: Int, inMonth: Bool, isPast: Bool) -> Color {
        guard inMonth && isPast else { return Color.white.opacity(inMonth ? 0.04 : 0.0) }
        switch played {
        case 0:  return Color.white.opacity(0.07)
        case 1:  return Color.yellow.opacity(0.20)
        case 2:  return Color.yellow.opacity(0.40)
        default: return Color.yellow.opacity(0.65)
        }
    }

    // MARK: - Legend

    private var legendRow: some View {
        HStack(spacing: 14) {
            legendItem(color: Color.white.opacity(0.07), label: "0")
            legendItem(color: Color.yellow.opacity(0.20), label: "1")
            legendItem(color: Color.yellow.opacity(0.40), label: "2")
            legendItem(color: Color.yellow.opacity(0.65), label: "3+")
            Spacer()
            HStack(spacing: 5) {
                RoundedRectangle(cornerRadius: 3)
                    .strokeBorder(Color.yellow, lineWidth: 2)
                    .frame(width: 13, height: 13)
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
                .frame(width: 13, height: 13)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.4))
        }
    }

    // MARK: - Summary cards (based on visible month)

    private var summaryCards: some View {
        let monthPrefix = monthPrefix(displayMonth)  // "2026-05"
        let monthEntries = store.calendarEntries.filter { $0.date.hasPrefix(monthPrefix) }
        let total      = monthEntries.reduce(0) { $0 + $1.gamesPlayed }
        let wins       = monthEntries.reduce(0) { $0 + $1.gamesWon }
        let activeDays = monthEntries.filter { $0.gamesPlayed > 0 }.count
        let streak     = currentStreak()

        return HStack(spacing: 10) {
            summaryCard(value: "\(activeDays)", label: "Active Days")
            summaryCard(value: "\(total)",      label: "Games")
            summaryCard(value: "\(wins)",       label: "Wins")
            summaryCard(value: "\(streak)🔥",  label: "Streak")
        }
    }

    private func summaryCard(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(.subheadline, design: .monospaced).bold())
                .foregroundStyle(.white)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }

    // MARK: - Grid cell data

    private struct DayCellInfo {
        let dateString: String?   // "yyyy-MM-dd", nil for padding
        let inCurrentMonth: Bool
        let isPast: Bool          // on or before today
    }

    /// Builds 42 DayCellInfo values (6 rows × 7 cols) for `displayMonth`.
    /// The grid starts on the Sunday on or before the 1st of the month.
    private func monthGridCells() -> [DayCellInfo] {
        let cal = Calendar.current
        let f   = DateFormatter(); f.dateFormat = "yyyy-MM-dd"

        // First day of the month being displayed
        let firstOfMonth = displayMonth

        // Weekday of the 1st (1=Sun … 7=Sat → 0-based index)
        let startWeekday = cal.component(.weekday, from: firstOfMonth) - 1

        // Grid start: Sunday on or before the 1st
        let gridStart = cal.date(byAdding: .day, value: -startWeekday, to: firstOfMonth)!

        let today = cal.startOfDay(for: Date())

        var cells: [DayCellInfo] = []
        for i in 0..<42 {
            guard let date = cal.date(byAdding: .day, value: i, to: gridStart) else { continue }
            let inMonth = cal.isDate(date, equalTo: firstOfMonth, toGranularity: .month)
            let isPast  = date <= today
            cells.append(DayCellInfo(
                dateString:     inMonth ? f.string(from: date) : nil,
                inCurrentMonth: inMonth,
                isPast:         isPast
            ))
        }
        return cells
    }

    // MARK: - Streak (rolling, from today backwards)

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
            } else { break }
        }
        return streak
    }

    // MARK: - Helpers

    private func dayNumber(from dateString: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: dateString) else { return "" }
        return "\(Calendar.current.component(.day, from: d))"
    }

    private func monthYearString(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "MMMM yyyy"
        return f.string(from: date)
    }

    private func monthPrefix(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM"
        return f.string(from: date)
    }

    private func cellAccessibilityLabel(info: DayCellInfo, entry: ProfileCalendarEntry?) -> String {
        guard let ds = info.dateString else { return "Inactive" }
        let f   = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let out = DateFormatter(); out.dateStyle = .full
        let label = f.date(from: ds).map { out.string(from: $0) } ?? ds
        guard let e = entry, e.gamesPlayed > 0 else { return "\(label), no games" }
        return "\(label), \(e.gamesPlayed) game\(e.gamesPlayed == 1 ? "" : "s"), \(e.gamesWon) won"
    }

    // MARK: - Static date helpers

    static func firstDayOfCurrentMonth() -> Date {
        let cal = Calendar.current
        let now = Date()
        let comps = cal.dateComponents([.year, .month], from: now)
        return cal.date(from: comps)!
    }

    static func firstDayOfMonth(monthsAgo: Int) -> Date {
        let cal = Calendar.current
        return cal.date(byAdding: .month, value: -monthsAgo, to: firstDayOfCurrentMonth())!
    }

    static func monthOffset(from date: Date, by months: Int) -> Date {
        Calendar.current.date(byAdding: .month, value: months, to: date)!
    }
}

// MARK: - Helper for sheet binding

private struct SelectedDay: Identifiable {
    let date: String
    var id: String { date }
}
