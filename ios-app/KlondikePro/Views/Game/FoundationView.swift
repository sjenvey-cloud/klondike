import SwiftUI

/// Displays the four foundation slots (one per suit).
struct FoundationView: View {

    let foundation: [Card?]   // 4 slots
    let cardWidth: CGFloat
    var onTap: (Int) -> Void

    // Suit symbols and names in slot order (clubs, diamonds, hearts, spades)
    private let suitSymbols = ["♣", "♦", "♥", "♠"]
    private let suitNames   = ["Clubs", "Diamonds", "Hearts", "Spades"]

    var body: some View {
        HStack(spacing: cardWidth * 0.12) {
            ForEach(0..<4, id: \.self) { index in
                slot(index: index)
                    .onTapGesture { onTap(index) }
            }
        }
    }

    @ViewBuilder
    private func slot(index: Int) -> some View {
        let topCard = index < foundation.count ? foundation[index] : nil
        let accessLabel = "Foundation \(suitNames[index]), \(topCard?.description ?? "empty")"

        Group {
            if let card = topCard {
                CardView(card: card, width: cardWidth)
            } else {
                placeholderSlot(symbol: suitSymbols[index])
            }
        }
        .accessibilityLabel(accessLabel)
        .accessibilityAddTraits(.isButton)
    }

    private func placeholderSlot(symbol: String) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.white.opacity(0.05))
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(
                    style: StrokeStyle(lineWidth: 1, dash: [4])
                )
                .foregroundStyle(Color.secondary.opacity(0.4))
            Text(symbol)
                .font(.title2)
                .foregroundStyle(.secondary)
        }
        .frame(width: cardWidth, height: cardWidth * 1.4)
    }
}
