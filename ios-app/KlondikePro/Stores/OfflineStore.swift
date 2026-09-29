import Foundation
import Observation

/// A game result that finished locally and is waiting to reach the server.
/// One of `clientId` (games we created with an idempotency key — online or offline)
/// or `serverSessionUuid` (a resumed/legacy session) tells the sync how to submit it.
struct PendingResult: Codable, Identifiable {
    let clientId: UUID?
    let serverSessionUuid: UUID?
    let seed: Int64
    let drawMode: String
    let isDaily: Bool
    let dailyDate: String?
    let status: String        // "won" | "abandoned"
    let moves: Int
    let timeSeconds: Int
    let turns: String
    let createdAt: Date

    var id: UUID { clientId ?? serverSessionUuid ?? UUID() }
}

/// Durable, offline-first result queue.
///
/// Every finished game is written here first (so a flaky/absent connection can never
/// lose a result — the source of the "couldn't save" false error), then synced in the
/// background. Sync is idempotent: `/sessions/offline` dedupes on `clientId`, and
/// `/complete` re-validates the same session, so retries are always safe.
@MainActor
@Observable
final class OfflineStore {

    static let shared = OfflineStore()

    private(set) var pending: [PendingResult] = []
    private var isSyncing = false

    private let fileURL: URL

    private init() {
        let dir = (try? FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true)) ?? FileManager.default.temporaryDirectory
        fileURL = dir.appendingPathComponent("offline_results.json")
        load()
    }

    var pendingCount: Int { pending.count }

    /// Queue a finished result (durably) — deduped by its identity.
    func enqueue(_ result: PendingResult) {
        if result.clientId != nil,
           pending.contains(where: { $0.clientId == result.clientId }) { return }
        if result.serverSessionUuid != nil,
           pending.contains(where: { $0.serverSessionUuid == result.serverSessionUuid }) { return }
        pending.append(result)
        save()
    }

    /// Try to flush the queue. Safe to call often; processes one result at a time and
    /// stops at the first transient failure so ordering and back-off are preserved.
    func flush() async {
        guard !isSyncing, !pending.isEmpty else { return }
        isSyncing = true
        defer { isSyncing = false }

        for result in pending.sorted(by: { $0.createdAt < $1.createdAt }) {
            do {
                try await submit(result)
                remove(result)                      // 2xx — durably done
            } catch let APIError.httpError(status, _) where status == 422 || status == 400 || status == 404 {
                // Permanently unprocessable (bad replay, malformed, or the session is
                // gone) — drop so one bad row can't wedge the whole queue.
                remove(result)
            } catch {
                // Network / auth / transient — keep it and stop; retry on the next flush.
                break
            }
        }
    }

    // MARK: - Submit one result (2xx = success; body ignored to avoid decode failures)

    private func submit(_ result: PendingResult) async throws {
        if let clientId = result.clientId {
            try await APIClient.shared.postBodyVoid(
                "/api/v1/sessions/offline",
                body: OfflineSessionRequest(
                    clientId: clientId,
                    seed: result.seed,
                    drawMode: result.drawMode,
                    isDaily: result.isDaily,
                    dailyDate: result.dailyDate,
                    status: result.status,
                    moves: result.moves,
                    timeSeconds: result.timeSeconds,
                    turns: result.turns))
        } else if let uuid = result.serverSessionUuid {
            let path = result.status == "won"
                ? "/api/v1/sessions/\(uuid)/complete"
                : "/api/v1/sessions/\(uuid)/abandon"
            try await APIClient.shared.postBodyVoid(
                path,
                body: CompleteSessionRequest(
                    moves: result.moves,
                    timeSeconds: result.timeSeconds,
                    turns: result.turns))
        } else {
            // No route to submit — drop by treating as a permanent failure.
            throw APIError.httpError(statusCode: 400, body: nil)
        }
    }

    // MARK: - Persistence

    private func remove(_ result: PendingResult) {
        pending.removeAll {
            (result.clientId != nil && $0.clientId == result.clientId) ||
            (result.serverSessionUuid != nil && $0.serverSessionUuid == result.serverSessionUuid)
        }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        pending = (try? JSONDecoder().decode([PendingResult].self, from: data)) ?? []
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(pending) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}
