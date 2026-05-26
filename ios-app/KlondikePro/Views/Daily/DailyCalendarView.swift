import SwiftUI

/// DEV-275 + DEV-277 — Monthly calendar grid showing won/played/not_played status.
/// Tapping a past day fetches that day's hand and starts a practice replay.
struct DailyCalendarView: View {

    @Environment(DailyStore.self) private var store

    /// Called when the user taps a past day and the game has been started,
    /// so DailyView can switch back to the Game tab.
    var onPlay: () -> Void

    @State private var displayedMonth: YearMonth = YearMonth.current
    @State private var loadingDate: String?       = nil
    @State private var loadError: String?         = nil

    var body: some View {
        VStack(spacing: 0) {
            // ── Month navigation ─────────────────────────────────────────
            monthNavBar

            Divider().background(Color.white.opacity(0.1))

            if store.isLoadingCalendar && store.calendarEntries.isEmpty {
                Spacer()
                ProgressView().tint(.yellow)
                Spacer()
            } else {
                // ── Day-of-week headers ──────────────────────────────────
                weekdayHeaders
                    .padding(.horizontal, 12)
                    .padding(.top, 8)

                // ── Day cells ────────────────────────────────────────────
                monthGrid
                    .padding(.horizontal, 12)

                legend
                    .padding(.top, 16)
                    .padding(.horizontal, 24)

                Spacer()
            }

            if let err = loadError {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(.red.opacity(0.8))
                    .padding(.bottom, 8)
            }
        }
        .task { await store.fetchCalendar() }
    }

    // MARK: - Month navigation

    private var monthNavBar: some View {
        HStack {
            Button {
                displayedMonth = displayedMonth.previous
            } label: {
                Image(systemName: "chevron.left")
                    .font(.title3)
                    .foregroundStyle(canGoPrev ? .white : .white.opacity(0.2))
            }
            .disabled(!canGoPrev)
            .accessibilityLabel("Previous month")

            Spacer()

            Text(displayedMonth.label)
                .font(.headline)
                .foregroundStyle(.white)

            Spacer()

            Button {
                displayedMonth = displayedMonth.next
            } label: {
                Image(systemName: "chevron.right")
                    .font(.title3)
                    .foregroundStyle(canGoNext ? .white : .white.opacity(0.2))
            }
            .disabled(!canGoNext)
            .accessibilityLabel("Next month")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    private var canGoPrev: Bool {
        guard let earliest = store.calendarEntries.first else { return false }
        return YearMonth(from: earliest.date) < displayedMonth
    }

    private var canGoNext: Bool {
        displayedMonth < YearMonth.current
    }

    // MARK: - Weekday headers

    private var weekdayHeaders: some View {
        HStack(spacing: 0) {
            ForEach(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], id: \.self) { day in
                Text(day)
                    .font(.caption2.bold())
                    .foregroundStyle(.white.opacity(0.35))
                    .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Month grid

    private var monthGrid: some View {
        let cells  = calendarCells
        let cols   = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

        return LazyVGrid(columns: cols, spacing: 4) {
            ForEach(0..<cells.count, id: \.self) { idx in
                let cell = cells[idx]
                if let day = cell {
                    dayCell(day: day, entry: entryFor(day: day))
                } else {
                    Color.clear
                        .frame(height: 44)
                }
            }
        }
    }

    private func dayCell(day: Int, entry: DailyCalendarEntry?) -> some View {
        let dateStr  = displayedMonth.dateString(day: day)
        let isToday  = dateStr == todayString()
        let isFuture = dateStr > todayString()
        let status   = entry?.userStatus ?? "not_played"
        let hasHand  = entry?.handUuid != nil
        let isLoading = loadingDate == dateStr

        return Button {
            guard !isFuture, hasHand, !isLoading else { return }
            Task { await tapDay(dateStr: dateStr, entry: entry) }
        } label: {
            ZStack {
                // Background circle
                Circle()
                    .fill(cellBackground(status: status, isToday: isToday, isFuture: isFuture, hasHand: hasHand))
                    .overlay(
                        Circle()
                            .strokeBorder(isToday ? Color.yellow : Color.clear, lineWidth: 2)
                    )

                if isLoading {
                    ProgressView()
                        .scaleEffect(0.6)
                        .tint(status == "won" ? Color.black : Color.white)
                } else {
                    Text("\(day)")
                        .font(.system(.caption, design: .rounded).weight(isToday ? .bold : .regular))
                        .foregroundStyle(cellForeground(status: status, isFuture: isFuture, hasHand: hasHand))
                }
            }
            .frame(height: 44)
        }
        .disabled(isFuture || !hasHand)
        .accessibilityLabel(accessibilityLabel(day: day, dateStr: dateStr, status: status, isFuture: isFuture, hasHand: hasHand))
    }

    // MARK: - Cell styling

    private func cellBackground(status: String, isToday: Bool, isFuture: Bool, hasHand: Bool) -> Color {
        guard hasHand && !isFuture else { return Color.clear }
        switch status {
        case "won":    return Color.yellow
        case "played": return Color.yellow.opacity(0.15)
        default:       return Color.white.opacity(0.07)
        }
    }

    private func cellForeground(status: String, isFuture: Bool, hasHand: Bool) -> Color {
        if isFuture || !hasHand { return Color.white.opacity(0.2) }
        if status == "won" { return Color.black }
        return Color.white.opacity(0.85)
    }

    private func accessibilityLabel(day: Int, dateStr: String, status: String, isFuture: Bool, hasHand: Bool) -> String {
        var parts = ["\(displayedMonth.monthName) \(day)"]
        if isFuture       { parts.append("future date") }
        else if !hasHand  { parts.append("no challenge") }
        else {
            switch status {
            case "won":    parts.append("completed")
            case "played": parts.append("played, not won")
            default:       parts.append("not played, tap to play")
            }
        }
        return parts.joined(separator: ", ")
    }

    // MARK: - Legend

    private var legend: some View {
        HStack(spacing: 20) {
            legendItem(color: .yellow, filled: true,  label: "Won")
            legendItem(color: .yellow, filled: false, label: "Played")
            legendItem(color: .white.opacity(0.07), filled: true, label: "Available")
        }
    }

    private func legendItem(color: Color, filled: Bool, label: String) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(filled ? color : Color.clear)
                .overlay(Circle().strokeBorder(color, lineWidth: 1.5))
                .frame(width: 14, height: 14)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.45))
        }
    }

    // MARK: - Day tap → start prior game (DEV-277)

    private func tapDay(dateStr: String, entry: DailyCalendarEntry?) async {
        loadError   = nil
        loadingDate = dateStr
        defer { loadingDate = nil }

        do {
            let response = try await store.fetchPastHand(date: dateStr)
            await store.startPriorGame(
                handUuid:    response.hand.uuid,
                shuffleSeed: response.hand.shuffleSeed,
                drawMode:    response.hand.drawMode,
                date:        response.date
            )
            onPlay()
        } catch {
            loadError = "Couldn't load the challenge for \(dateStr)."
        }
    }

    // MARK: - Calendar data helpers

    private func entryFor(day: Int) -> DailyCalendarEntry? {
        let dateStr = displayedMonth.dateString(day: day)
        return store.calendarEntries.first { $0.date == dateStr }
    }

    /// Returns an array of 7 * n cells. Nil = padding before the first day.
    private var calendarCells: [Int?] {
        let firstWeekday = displayedMonth.firstWeekday  // 0 = Sunday
        let dayCount     = displayedMonth.dayCount
        var cells: [Int?] = Array(repeating: nil, count: firstWeekday)
        cells += (1...dayCount).map { Optional($0) }
        // Pad to complete the last row
        let remainder = cells.count % 7
        if remainder > 0 { cells += Array(repeating: nil, count: 7 - remainder) }
        return cells
    }

    private func todayString() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }
}

// MARK: - YearMonth helper

struct YearMonth: Equatable, Comparable {
    let year: Int
    let month: Int   // 1-12

    static var current: YearMonth {
        let c = Calendar.current.dateComponents([.year, .month], from: Date())
        return YearMonth(year: c.year!, month: c.month!)
    }

    init(year: Int, month: Int) {
        self.year  = year
        self.month = month
    }

    init(from dateString: String) {
        let parts = dateString.split(separator: "-")
        year  = Int(parts[0]) ?? 2026
        month = Int(parts[1]) ?? 1
    }

    var previous: YearMonth {
        month == 1 ? YearMonth(year: year - 1, month: 12) : YearMonth(year: year, month: month - 1)
    }

    var next: YearMonth {
        month == 12 ? YearMonth(year: year + 1, month: 1) : YearMonth(year: year, month: month + 1)
    }

    var label: String {
        let f = DateFormatter()
        f.dateFormat = "MMMM yyyy"
        return f.string(from: date(day: 1)!)
    }

    var monthName: String {
        let f = DateFormatter()
        f.dateFormat = "MMMM"
        return f.string(from: date(day: 1)!)
    }

    var dayCount: Int {
        Calendar.current.range(of: .day, in: .month, for: date(day: 1)!)!.count
    }

    /// 0 = Sunday, matching the Su Mo Tu We Th Fr Sa header
    var firstWeekday: Int {
        let cal = Calendar.current
        let comps = DateComponents(year: year, month: month, day: 1)
        let d = cal.date(from: comps)!
        return cal.component(.weekday, from: d) - 1   // Calendar.weekday is 1-indexed
    }

    func dateString(day: Int) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    func date(day: Int) -> Date? {
        Calendar.current.date(from: DateComponents(year: year, month: month, day: day))
    }

    static func < (lhs: YearMonth, rhs: YearMonth) -> Bool {
        lhs.year == rhs.year ? lhs.month < rhs.month : lhs.year < rhs.year
    }
}
