import Foundation
import MetricKit
import os

/// DEV-327 — crash & diagnostic reporting via MetricKit.
///
/// Subscribes to `MXMetricManager` to receive the system's daily aggregated
/// metrics and, more importantly, diagnostic payloads (crashes, hangs, disk-write
/// and CPU exceptions). Payloads are logged via the unified logging system so they
/// surface in Console / device logs; on TestFlight + App Store builds the same
/// crash data is also delivered to Xcode Organizer automatically.
///
/// No third-party SDK and no off-device transmission — MetricKit data stays local,
/// keeping the privacy manifest simple (no crash-data collection declared).
final class MetricsReporter: NSObject, MXMetricManagerSubscriber {

    static let shared = MetricsReporter()

    private let log = Logger(subsystem: "com.klondikepro.app", category: "metrics")

    /// Register as a subscriber. Call once, early in app launch.
    func start() {
        MXMetricManager.shared.add(self)
    }

    // MARK: - MXMetricManagerSubscriber

    /// Daily aggregated performance metrics (launch time, memory, battery, etc.).
    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            log.info("MetricKit metrics payload: \(payload.dictionaryRepresentation().description, privacy: .public)")
        }
    }

    /// Diagnostics — crashes, hangs, disk-write and CPU exceptions (iOS 14+).
    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            for crash in payload.crashDiagnostics ?? [] {
                log.error("MetricKit CRASH: \(crash.dictionaryRepresentation().description, privacy: .public)")
            }
            for hang in payload.hangDiagnostics ?? [] {
                log.warning("MetricKit hang: \(hang.dictionaryRepresentation().description, privacy: .public)")
            }
            for cpu in payload.cpuExceptionDiagnostics ?? [] {
                log.warning("MetricKit CPU exception: \(cpu.dictionaryRepresentation().description, privacy: .public)")
            }
            for disk in payload.diskWriteExceptionDiagnostics ?? [] {
                log.warning("MetricKit disk-write exception: \(disk.dictionaryRepresentation().description, privacy: .public)")
            }
        }
    }
}
