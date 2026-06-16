import SwiftUI

/// Displays the seven tableau columns.
struct TableauView: View {

    let columns: [[Card]]
    let cardWidth: CGFloat
    var onTap: (Int, Int) -> Void
    /// Resolve a drag dropped on column `colIdx`; returns true if the move was made.
    var onDropToColumn: (CardMove, Int) -> Bool = { _, _ in false }

    private let faceDownOffset: CGFloat = 0.15
    private let faceUpOffset: CGFloat   = 0.28

    var body: some View {
        HStack(alignment: .top, spacing: columnSpacing) {
            ForEach(0..<7, id: \.self) { colIdx in
                columnView(colIdx: colIdx)
            }
        }
    }

    private var columnSpacing: CGFloat {
        max(2, (cardWidth * 0.1))
    }

    @ViewBuilder
    private func columnView(colIdx: Int) -> some View {
        let col = colIdx < columns.count ? columns[colIdx] : []
        let cardHeight = cardWidth * 1.4

        if col.isEmpty {
            // Empty column placeholder — King hint only, no tap action needed
            // (auto-move routes Kings here automatically when you tap the King)
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(
                                style: StrokeStyle(lineWidth: 1, dash: [4])
                            )
                            .foregroundStyle(Color.secondary.opacity(0.4))
                    )
                Text("K")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
            .frame(width: cardWidth, height: cardHeight)
            .dropDestination(for: CardMove.self) { items, _ in
                guard let move = items.first else { return false }
                return onDropToColumn(move, colIdx)
            }
            .accessibilityLabel("Empty column \(colIdx + 1), place a King here")
        } else {
            // VStack(spacing: 0) with constrained layout heights so that each
            // card's hit-test region sits at its true visual position.
            //
            // .offset() is a pure visual transform — it does NOT move the hit
            // region. Using a layout height of `peekHeight` for every card except
            // the last means the VStack places each card at the correct y, and
            // the card renders at full height (overflowing below its layout frame)
            // to create the natural stacking effect.
            VStack(spacing: 0) {
                ForEach(Array(col.enumerated()), id: \.offset) { idx, card in
                    let isLast  = idx == col.count - 1
                    let peekH   = cardWidth * (card.isFaceUp ? faceUpOffset : faceDownOffset)
                    let base = CardView(
                        card: card,
                        isSelected: false,
                        width: cardWidth
                    )
                    .frame(width: cardWidth,
                           height: isLast ? cardHeight : peekH,
                           alignment: .top)
                    .contentShape(Rectangle())
                    .onTapGesture { onTap(colIdx, idx) }
                    .accessibilityLabel(card.isFaceUp ? card.accessibilityLabel : "Face down card in column \(colIdx + 1)")
                    .accessibilityAddTraits(card.isFaceUp ? .isButton : [])

                    // Face-up cards are draggable; dragging from idx carries the whole
                    // sub-stack below it (the move resolver handles single vs stack).
                    if card.isFaceUp {
                        base.draggable(CardMove(source: .tableau(col: colIdx, idx: idx))) {
                            CardView(card: card, width: cardWidth)
                        }
                    } else {
                        base
                    }
                }
            }
            .frame(width: cardWidth, height: totalColumnHeight(col: col))
            .dropDestination(for: CardMove.self) { items, _ in
                guard let move = items.first else { return false }
                return onDropToColumn(move, colIdx)
            }
        }
    }

    // MARK: - Geometry helpers

    /// Cumulative Y offset for the card at `upToIdx` in the column.
    private func cumulativeOffset(col: [Card], upToIdx: Int) -> CGFloat {
        guard upToIdx > 0 else { return 0 }
        var offset: CGFloat = 0
        for i in 0..<upToIdx {
            offset += cardWidth * (col[i].isFaceUp ? faceUpOffset : faceDownOffset)
        }
        return offset
    }

    /// Total height needed for the VStack so it doesn't clip.
    private func totalColumnHeight(col: [Card]) -> CGFloat {
        let cardHeight = cardWidth * 1.4
        guard !col.isEmpty else { return cardHeight }
        let stackedHeight = cumulativeOffset(col: col, upToIdx: col.count - 1)
        return stackedHeight + cardHeight
    }
}
