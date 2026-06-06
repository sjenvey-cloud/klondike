import SwiftUI

/// DEV-276 — Presented as a sheet when the user wins a daily challenge.
///
/// Shows:
///   • Moves + time achieved
///   • Rank reveal (nil = could not retrieve, shown as "—")
///   • Action buttons: View Leaderboard, View Calendar, Play Again
/// Every daily attempt is ranked; confetti respects the win-animation preference.
struct DailyWinView: View {

    let result: DailyWinResult
    var onLeaderboard: () -> Void
    var onCalendar: (() -> Void)?
    var onPlayAgain: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(PreferencesStore.self) private var prefs

    /// DEV-291: only show confetti when the user's win-animation preference is "confetti".
    private var showConfetti: Bool { prefs.preferences.winAnimation == "confetti" }

    @State private var animatedRank: Int  = 0
    @State private var showDetails: Bool  = false
    @State private var showReplay: Bool   = false   // DEV-307

    var body: some View {
        ZStack {
            // ── Background ──────────────────────────────────────────────
            Color(red: 0.05, green: 0.07, blue: 0.10)
                .ignoresSafeArea()

            if showConfetti {
                ConfettiLayer()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }

            // ── Content ─────────────────────────────────────────────────
            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: 48)

                    // Trophy icon
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(.yellow)
                        .symbolEffect(.bounce, value: showDetails)
                        .padding(.bottom, 24)

                    // Headline
                    Text("Challenge Complete!")
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                        .padding(.bottom, 4)

                    Text(result.date)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.45))
                        .padding(.bottom, 32)

                    // Stats row
                    HStack(spacing: 32) {
                        statBlock(
                            value: "\(result.moves)",
                            label: "Moves"
                        )
                        statDivider
                        statBlock(
                            value: formattedTime(result.timeSeconds),
                            label: "Time"
                        )
                        statDivider
                        rankBlock
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 28)
                    .background(Color.white.opacity(0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, 24)

                    Spacer(minLength: 40)

                    // Action buttons
                    VStack(spacing: 12) {
                        Button(action: { onLeaderboard() }) {
                            Label("View Leaderboard", systemImage: "list.number")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.yellow)
                        .foregroundStyle(.black)

                        if let onCalendar {
                            Button(action: { onCalendar() }) {
                                Label("View Calendar", systemImage: "calendar")
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 52)
                            }
                            .buttonStyle(.bordered)
                            .tint(.white)
                            .foregroundStyle(.white)
                        }

                        if let onPlayAgain {
                            Button(action: { onPlayAgain() }) {
                                Label("Play Again", systemImage: "arrow.clockwise")
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 52)
                            }
                            .buttonStyle(.bordered)
                            .tint(.white.opacity(0.5))
                            .foregroundStyle(.white.opacity(0.7))
                        }

                        // Watch Replay (DEV-307)
                        if let uuid = result.sessionUuid {
                            Button {
                                showReplay = true
                            } label: {
                                Label("Watch Replay", systemImage: "play.rectangle.fill")
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 52)
                            }
                            .buttonStyle(.bordered)
                            .tint(.white.opacity(0.5))
                            .foregroundStyle(.white.opacity(0.7))
                            .sheet(isPresented: $showReplay) {
                                ReplayView(sessionUuid: uuid)
                            }
                        }

                        Button {
                            dismiss()
                        } label: {
                            Text("Done")
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.5))
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                        }
                    }
                    .padding(.horizontal, 24)

                    Spacer(minLength: 32)
                }
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) { showDetails = true }
            if let rank = result.rank {
                animateRank(to: rank)
            }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: - Sub-views

    private func statBlock(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(.title2, design: .monospaced).bold())
                .foregroundStyle(.white)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.45))
        }
    }

    private var statDivider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.12))
            .frame(width: 1, height: 36)
    }

    private var rankBlock: some View {
        VStack(spacing: 4) {
            Group {
                if let _ = result.rank {
                    Text("#\(animatedRank)")
                } else {
                    Text("—")
                }
            }
            .font(.system(.title2, design: .monospaced).bold())
            .foregroundStyle(.yellow)
            .contentTransition(.numericText())

            Text("Rank")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.45))
        }
    }

    // MARK: - Helpers

    private func formattedTime(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private func animateRank(to target: Int) {
        // Count down quickly from a random higher number to the real rank
        let start = min(target + Int.random(in: 15...40), 999)
        animatedRank = start
        let steps = min(start - target, 20)
        guard steps > 0 else { animatedRank = target; return }
        let stepSize = max(1, (start - target) / steps)

        for i in 0..<steps {
            let delay = Double(i) * 0.06
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4 + delay) {
                withAnimation(.easeInOut(duration: 0.05)) {
                    animatedRank = max(target, animatedRank - stepSize)
                }
            }
        }
        // Guarantee we land exactly on target
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4 + Double(steps) * 0.06 + 0.1) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                animatedRank = target
            }
        }
    }
}

// MARK: - Confetti

private struct ConfettiLayer: View {

    @State private var particles: [ConfettiParticle] = []

    var body: some View {
        GeometryReader { geo in
            ForEach(particles) { p in
                Circle()
                    .fill(p.color)
                    .frame(width: p.size, height: p.size)
                    .position(x: p.x, y: p.y)
                    .opacity(p.opacity)
            }
            .onAppear {
                spawnParticles(in: geo.size)
            }
        }
    }

    private func spawnParticles(in size: CGSize) {
        for i in 0..<60 {
            let delay = Double(i) * 0.03
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                let p = ConfettiParticle(
                    x: CGFloat.random(in: 0...size.width),
                    y: -10,
                    size: CGFloat.random(in: 5...10),
                    color: [Color.yellow, Color.white, Color.orange, Color.green.opacity(0.8)].randomElement()!,
                    opacity: Double.random(in: 0.7...1.0)
                )
                particles.append(p)
                let idx = particles.count - 1

                withAnimation(.easeIn(duration: Double.random(in: 1.2...2.0))) {
                    particles[idx].y = size.height + 20
                    particles[idx].opacity = 0
                }
            }
        }
    }
}

private struct ConfettiParticle: Identifiable {
    let id = UUID()
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var color: Color
    var opacity: Double
}
