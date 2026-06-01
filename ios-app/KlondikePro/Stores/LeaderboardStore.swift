import Foundation

// MARK: - LeaderboardStore (DEV-303, DEV-304)

/// Manages global leaderboard state: fetches from /api/v1/leaderboard/global
/// with period, drawMode, and sort filters. Cursor-paginated (offset-based).
///
/// One instance lives in ContentView and is injected via the environment.
@MainActor
@Observable
final class LeaderboardStore {

    // MARK: - Auth context (set by ContentView after login)
    var userUuid: UUID?

    // MARK: - Filter state

    var period:   String = "weekly"   // weekly | monthly | all-time
    var drawMode: String = "draw3"    // draw1 | draw3
    var sort:     String = "moves"    // moves | time

    // MARK: - Data

    private(set) var entries:        [GlobalLeaderboardEntry] = []
    private(set) var myEntry:        GlobalLeaderboardEntry?
    private(set) var hasMore:        Bool   = false
    private(set) var nextCursor:     String? = nil

    // MARK: - Loading

    private(set) var isLoading:     Bool = false
    private(set) var isLoadingMore: Bool = false

    // MARK: - Fetch (resets list, used when filters change)

    func fetchLeaderboard() async {
        guard !isLoading else { return }
        isLoading = true
        entries   = []
        nextCursor = nil
        defer { isLoading = false }

        do {
            let page: PagedResponse<GlobalLeaderboardEntry> = try await APIClient.shared.get(
                "/api/v1/leaderboard/global",
                query: [
                    "period":   period,
                    "drawMode": drawMode,
                    "sort":     sort,
                    "limit":    "50"
                ]
            )
            entries    = page.items
            hasMore    = page.hasMore
            nextCursor = page.nextCursor
        } catch {
            entries = []
        }

        // Fetch my rank in parallel (non-blocking — errors are silent)
        await fetchMyRank()
    }

    // MARK: - Load more (DEV-304, cursor pagination)

    func loadMore() async {
        guard hasMore, let cursor = nextCursor, !isLoadingMore, !isLoading else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let page: PagedResponse<GlobalLeaderboardEntry> = try await APIClient.shared.get(
                "/api/v1/leaderboard/global",
                query: [
                    "period":   period,
                    "drawMode": drawMode,
                    "sort":     sort,
                    "limit":    "50",
                    "cursor":   cursor
                ]
            )
            entries.append(contentsOf: page.items)
            hasMore    = page.hasMore
            nextCursor = page.nextCursor
        } catch {
            // Silently fail — user can scroll up and try again
        }
    }

    // MARK: - My rank

    func fetchMyRank() async {
        guard let uuid = userUuid else { return }
        do {
            myEntry = try await APIClient.shared.get(
                "/api/v1/leaderboard/global/\(uuid.uuidString.lowercased())/rank",
                query: [
                    "period":   period,
                    "drawMode": drawMode,
                    "sort":     sort
                ]
            )
        } catch {
            myEntry = nil   // 404 = no qualifying win; other errors silent
        }
    }
}
