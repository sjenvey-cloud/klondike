import SwiftUI

// MARK: - ReplayBoardView (DEV-305)

/// Read-only board view used by the session replay viewer.
///
/// Renders a `GameState` snapshot with the same visual layout as the live board
/// (stock, waste, foundation, 7 tableau columns) but with no tap interaction.
struct ReplayBoardView: View {

    let state: GameState

    var body: some View {
        GeometryReader { proxy in
            let spacing: CGFloat = 16 * 2 + 6 * 6
            let cardWidth = max(28, (proxy.size.width - spacing) / 7)

            VStack(spacing: 8) {
                topRow(cardWidth: cardWidth)
                tableau(cardWidth: cardWidth)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Top row

    private func topRow(cardWidth: CGFloat) -> some View {
        HStack(alignment: .top, spacing: 6) {
            // Stock pile
            stockView(cardWidth: cardWidth)

            // Waste (top card)
            wasteView(cardWidth: cardWidth)

            Spacer()

            // 4 foundation slots
            ForEach(0..<4) { slot in
                foundationSlot(index: slot, cardWidth: cardWidth)
            }
        }
    }

    private func stockView(cardWidth: CGFloat) -> some View {
        let height = cardWidth * 1.4
        return ZStack {
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(Color.white.opacity(0.25), lineWidth: 1)
                .frame(width: cardWidth, height: height)

            if !state.stock.isEmpty {
                // Show a face-down card
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(red: 0.11, green: 0.14, blue: 0.20))
                    .frame(width: cardWidth, height: height)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .strokeBorder(Color.white.opacity(0.12), lineWidth: 1.5)
                            .padding(4)
                    )

                // Card count badge
                Text("\(state.stock.count)")
                    .font(.caption2.bold())
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(3)
                    .background(Color.black.opacity(0.5))
                    .clipShape(Capsule())
                    .offset(x: cardWidth * 0.3, y: -height * 0.38)
            }
        }
    }

    private func wasteView(cardWidth: CGFloat) -> some View {
        let height = cardWidth * 1.4
        return Group {
            if let top = state.waste.last {
                ReplayCardView(card: top, width: cardWidth)
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(Color.white.opacity(0.15), lineWidth: 1)
                    .frame(width: cardWidth, height: height)
            }
        }
    }

    private func foundationSlot(index: Int, cardWidth: CGFloat) -> some View {
        let height = cardWidth * 1.4
        let card = state.foundation[index]
        let suitSymbols = ["♣", "♦", "♥", "♠"]
        return ZStack {
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
                .frame(width: cardWidth, height: height)

            if let c = card {
                ReplayCardView(card: c, width: cardWidth)
            } else {
                Text(suitSymbols[index])
                    .font(.system(size: cardWidth * 0.35))
                    .foregroundStyle(.white.opacity(0.2))
            }
        }
    }

    // MARK: - Tableau

    private func tableau(cardWidth: CGFloat) -> some View {
        HStack(alignment: .top, spacing: 6) {
            ForEach(0..<7) { col in
                tableauColumn(col: col, cardWidth: cardWidth)
            }
        }
    }

    private func tableauColumn(col: Int, cardWidth: CGFloat) -> some View {
        let column = state.tableau[col]
        let height = cardWidth * 1.4
        let faceDownOffset: CGFloat = cardWidth * 0.22
        let faceUpOffset:   CGFloat = cardWidth * 0.38

        return ZStack(alignment: .top) {
            // Empty slot placeholder
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(Color.white.opacity(0.15), lineWidth: 1)
                .frame(width: cardWidth, height: height)

            // Cards stacked with fan offsets
            ForEach(Array(column.enumerated()), id: \.offset) { idx, card in
                let prior = column[..<idx]
                let yOffset = prior.reduce(0.0) { acc, c in
                    acc + (c.isFaceUp ? faceUpOffset : faceDownOffset)
                }
                ReplayCardView(card: card, width: cardWidth)
                    .offset(y: yOffset)
            }
        }
        .frame(
            width: cardWidth,
            height: column.isEmpty
                ? height
                : columnHeight(column: column,
                               cardWidth: cardWidth,
                               faceDownOffset: faceDownOffset,
                               faceUpOffset: faceUpOffset,
                               fullHeight: height)
        )
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private func columnHeight(
        column: [Card],
        cardWidth: CGFloat,
        faceDownOffset: CGFloat,
        faceUpOffset: CGFloat,
        fullHeight: CGFloat
    ) -> CGFloat {
        guard !column.isEmpty else { return fullHeight }
        let offsets = column.dropLast().reduce(0.0) { acc, c in
            acc + (c.isFaceUp ? faceUpOffset : faceDownOffset)
        }
        return offsets + fullHeight
    }
}

// MARK: - ReplayCardView

/// Simplified read-only card rendering for the replay board.
private struct ReplayCardView: View {

    let card: Card
    let width: CGFloat

    private var height: CGFloat { width * 1.4 }

    var body: some View {
        if card.isFaceUp {
            faceUp
        } else {
            faceDown
        }
    }

    private var faceUp: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(uiColor: .systemBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Color.primary.opacity(0.15), lineWidth: 1)
                )

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(card.rank.description)
                            .font(.system(size: max(7, width * 0.17)).bold())
                            .foregroundStyle(card.isRed ? Color.red : Color.primary)
                        Text(card.suit.description)
                            .font(.system(size: max(6, width * 0.14)))
                            .foregroundStyle(card.isRed ? Color.red : Color.primary)
                    }
                    Spacer()
                }
                Spacer()
            }
            .padding(3)
        }
        .frame(width: width, height: height)
    }

    private var faceDown: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(red: 0.11, green: 0.14, blue: 0.20))
            RoundedRectangle(cornerRadius: 6)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1.5)
                .padding(4)
        }
        .frame(width: width, height: height)
    }
}
