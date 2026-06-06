import SwiftUI

/// Celebratory confetti burst, shared by the random-game `WinView` and the
/// `DailyWinView`. Gate its presentation on the user's win-animation preference
/// (`winAnimation == "confetti"`) at the call site.
struct ConfettiLayer: View {

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
