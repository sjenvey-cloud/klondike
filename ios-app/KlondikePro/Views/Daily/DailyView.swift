import SwiftUI

/// DEV-272 — 3-tab Daily Challenge screen: Game / Leaderboard / Calendar.
///
/// Injected into the Daily tab in ContentView. DailyStore is read from the
/// environment, which is populated by ContentView on app launch.
struct DailyView: View {

    @Environment(DailyStore.self) private var store
    @Environment(\.feltColor) private var feltColor
    @State private var selectedTab: DailyTab = .game

    enum DailyTab { case game, leaderboard, calendar }

    var body: some View {
        VStack(spacing: 0) {
            // ── Header ──────────────────────────────────────────────────────
            header

            // ── Tab bar ──────────────────────────────────────────────────────
            tabPicker

            Divider()
                .background(Color.white.opacity(0.12))

            // ── Tab content ──────────────────────────────────────────────────
            Group {
                switch selectedTab {
                case .game:
                    DailyGameTab(onSwitchToLeaderboard: { selectedTab = .leaderboard })

                case .leaderboard:
                    DailyLeaderboardView()

                case .calendar:
                    DailyCalendarView(onPlay: { selectedTab = .game })
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(feltColor.ignoresSafeArea())
        .onAppear {
            if store.dailyHand == nil && !store.isLoadingHand {
                Task { await store.fetchToday() }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 2) {
            Text("Daily Challenge")
                .font(.title2.bold())
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)

            Text(store.dailyDate.isEmpty ? "Loading…" : store.dailyDate)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.55))
                .accessibilityLabel("Challenge date: \(store.dailyDate)")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    // MARK: - Tab picker

    private var tabPicker: some View {
        HStack(spacing: 0) {
            tabButton("Game",        tab: .game,        icon: "suit.club.fill")
            tabButton("Leaderboard", tab: .leaderboard, icon: "list.number")
            tabButton("Calendar",    tab: .calendar,    icon: "calendar")
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func tabButton(_ label: String, tab: DailyTab, icon: String) -> some View {
        let active = selectedTab == tab
        return Button {
            selectedTab = tab
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: active ? .semibold : .regular))
                Text(label)
                    .font(.caption.weight(active ? .semibold : .regular))
            }
            .foregroundStyle(active ? Color.yellow : Color.white.opacity(0.5))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }
}
