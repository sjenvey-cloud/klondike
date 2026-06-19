import SwiftUI
import GameKit

/// Presents Apple's native Game Center leaderboard UI for a specific leaderboard
/// (today's recurrence). Used from the daily win screen so players can see their
/// Daily Challenge ranking right after winning.
struct GameCenterLeaderboardSheet: UIViewControllerRepresentable {

    let leaderboardID: String

    func makeUIViewController(context: Context) -> GKGameCenterViewController {
        let vc = GKGameCenterViewController(
            leaderboardID: leaderboardID,
            playerScope: .global,
            timeScope: .today
        )
        vc.gameCenterDelegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: GKGameCenterViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, GKGameCenterControllerDelegate {
        func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
            gameCenterViewController.dismiss(animated: true)
        }
    }
}
