import SwiftUI

/// Displays the seven tableau columns.
struct TableauView: View {

    let columns: [[Card]]
    let cardWidth: CGFloat
    var dragModel: BoardDragModel
    var onTap: (Int, Int) -> Void

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
            .dropZone(.column(colIdx))
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

                    // Face-up cards drag (carrying the sub-stack from idx down). The
                    // source hides while the lifted copy floats on top; highPriority so
                    // the card wins over the tableau scroll.
                    if card.isFaceUp {
                        base
                            .opacity(isDragging(colIdx, idx) ? 0 : 1)
                            .highPriorityGesture(
                                dragGesture(col: colIdx, idx: idx, cards: Array(col[idx...]))
                            )
                    } else {
                        base
                    }
                }
            }
            .frame(width: cardWidth, height: totalColumnHeight(col: col))
            .dropZone(.column(colIdx))
        }
    }

    // MARK: - Drag

    private func dragGesture(col: Int, idx: Int, cards: [Card]) -> some Gesture {
        DragGesture(minimumDistance: 6, coordinateSpace: .named(BoardSpace.name))
            .onChanged { value in
                if !dragModel.isDragging {
                    dragModel.begin(.tableau(col: col, idx: idx),
                                    cards: cards, cardWidth: cardWidth, at: value.location)
                } else {
                    dragModel.move(to: value.location)
                }
            }
            .onEnded { _ in dragModel.end() }
    }

    /// True for the dragged card and every card beneath it in the same column.
    private func isDragging(_ col: Int, _ idx: Int) -> Bool {
        if case .tableau(let c, let i)? = dragModel.source { return c == col && idx >= i }
        return false
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
