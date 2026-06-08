import SwiftUI

/// Single card view used throughout the game board.
/// WCAG 2.1 AA: all cards have an accessibilityLabel.
struct CardView: View {

    let card: Card
    var isSelected: Bool = false
    let width: CGFloat

    private var height: CGFloat { width * 1.4 }
    private var cornerRadius: CGFloat { 8 }

    var body: some View {
        Group {
            if card.isFaceUp {
                faceUpView
            } else {
                faceDownView
            }
        }
        .frame(width: width, height: height)
        .shadow(radius: 2, y: 1)
        .accessibilityLabel(card.isFaceUp ? card.accessibilityLabel : "Face down card")
    }

    // MARK: - Face Up

    @Environment(\.cardStyle) private var cardStyle

    /// Face artwork loaded from the CDN by style (matches the web). While loading
    /// or if the image is unavailable, the programmatic face is shown so the board
    /// is always legible.
    private var faceUpView: some View {
        ZStack {
            if let url = CardArt.faceURL(for: card, style: cardStyle) {
                AsyncImage(url: url, transaction: Transaction(animation: .none)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                    default:
                        programmaticFace
                    }
                }
            } else {
                programmaticFace
            }
        }
        .frame(width: width, height: height)
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius)
                .strokeBorder(Color.yellow, lineWidth: isSelected ? 2 : 0)
        )
    }

    // MARK: - Programmatic face (fallback / placeholder)

    private var programmaticFace: some View {
        ZStack {
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(Color(uiColor: .systemBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .strokeBorder(Color.primary.opacity(0.15), lineWidth: 1)
                )

            // Top-left rank + suit
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(card.rank.description)
                            .font(.caption.bold())
                            .foregroundStyle(cardColor)
                        Text(card.suit.description)
                            .font(.caption2)
                            .foregroundStyle(cardColor)
                    }
                    Spacer()
                }
                Spacer()

                // Bottom-right rank + suit (rotated 180)
                HStack {
                    Spacer()
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(card.rank.description)
                            .font(.caption.bold())
                            .foregroundStyle(cardColor)
                        Text(card.suit.description)
                            .font(.caption2)
                            .foregroundStyle(cardColor)
                    }
                    .rotationEffect(.degrees(180))
                }
            }
            .padding(4)

            // Large centered suit symbol
            Text(card.suit.description)
                .font(.title2)
                .foregroundStyle(cardColor)
        }
    }

    // MARK: - Face Down

    @Environment(\.cardBackColor) private var cardBackColor

    private var faceDownView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(cardBackColor)
            RoundedRectangle(cornerRadius: cornerRadius - 2)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1.5)
                .padding(4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius)
                .strokeBorder(isSelected ? Color.yellow : Color.clear, lineWidth: 2)
        )
    }

    // MARK: - Helpers

    private var cardColor: Color {
        card.isRed ? .red : .primary
    }
}

// MARK: - Preview

#if DEBUG
#Preview {
    HStack(spacing: 8) {
        if let card1 = Card(id: 1, isFaceUp: true) {
            CardView(card: card1, width: 60)
        }
        if let card2 = Card(id: 14, isFaceUp: true) {
            CardView(card: card2, isSelected: true, width: 60)
        }
        if let card3 = Card(id: 27, isFaceUp: false) {
            CardView(card: card3, width: 60)
        }
    }
    .padding()
}
#endif
