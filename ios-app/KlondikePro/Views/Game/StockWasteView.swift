import SwiftUI

/// Displays the stock (draw pile) and waste (discard) piles side by side.
struct StockWasteView: View {

    let store: GameStore
    let cardWidth: CGFloat
    /// When the stock pile sits on the right of the board, render the face-down
    /// draw pile on the FAR right (waste to its left) — easier to reach in play.
    var stockOnRight: Bool = false
    var dragModel: BoardDragModel
    var onWasteTap: () -> Void
    var onStockTap: () -> Void

    private var height: CGFloat { cardWidth * 1.4 }
    private var spacing: CGFloat { cardWidth * 0.25 }

    var body: some View {
        HStack(spacing: spacing) {
            if stockOnRight {
                wastePile
                stockPile
            } else {
                stockPile
                wastePile
            }
        }
    }

    // MARK: - Stock Pile

    private var stockPile: some View {
        let stock = store.state?.stock ?? []
        return ZStack {
            placeholderRect

            if stock.isEmpty {
                // Empty stock — circular arrow to flip waste back
                Image(systemName: "arrow.circlepath")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            } else {
                // Face-down card with count badge
                if let topCard = stock.first.map({ _ in Card(id: 1, isFaceUp: false)! }) {
                    CardView(card: topCard, width: cardWidth)
                }
                // Count badge
                Text("\(stock.count)")
                    .font(.caption2.bold())
                    .foregroundStyle(.white)
                    .padding(4)
                    .background(Color.black.opacity(0.6), in: Circle())
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(4)
            }
        }
        .frame(width: cardWidth, height: height)
        .onTapGesture { onStockTap() }
        .accessibilityLabel(stock.isEmpty ? "Stock empty, tap to reset" : "Stock, \(stock.count) cards remaining")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Waste Pile

    /// Horizontal offset between fanned waste cards — matches the web (FAN = 0.46·cardW)
    /// so Draw 3 shows the same 3-card peek on both platforms (fairness: neither
    /// platform sees more of the drawn cards than the other).
    private var fan: CGFloat { cardWidth * 0.46 }

    /// Draw 3 reserves room for the 3-card fan; Draw 1 is a single card.
    private var wasteSlotWidth: CGFloat {
        let isDraw3 = (store.state?.drawMode ?? "draw3") == "draw3"
        return cardWidth + (isDraw3 ? fan * 2 : 0)
    }

    private var wastePile: some View {
        let waste   = store.state?.waste ?? []
        let isDraw3 = (store.state?.drawMode ?? "draw3") == "draw3"
        let n       = waste.count

        return ZStack(alignment: .leading) {
            placeholderRect

            if n == 0 {
                // Empty placeholder with dotted border
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4]))
                    .foregroundStyle(Color.secondary.opacity(0.5))
                    .frame(width: cardWidth, height: height)
            } else {
                // Draw 3: fan the last up-to-3 cards, oldest at the left, the
                // newest (top) on the right — the only playable one. Mirrors the
                // web's offsets exactly. Draw 1: just the single top card.
                if isDraw3, n > 2 {
                    CardView(card: waste[n - 3], width: cardWidth)
                }
                if isDraw3, n > 1 {
                    CardView(card: waste[n - 2], width: cardWidth)
                        .offset(x: min(CGFloat(n - 2), 1) * fan)
                }
                CardView(card: waste[n - 1], width: cardWidth)
                    .offset(x: isDraw3 ? min(CGFloat(n - 1), 2) * fan : 0)
                    .opacity(isDraggingWaste ? 0 : 1)
                    .highPriorityGesture(wasteDragGesture(top: waste[n - 1]))
            }
        }
        .frame(width: wasteSlotWidth, height: height, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture {
            if n > 0 { onWasteTap() }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(waste.last.map { "Waste, top card \($0.accessibilityLabel), \(n) cards" } ?? "Waste, empty")
        .accessibilityAddTraits(n > 0 ? .isButton : [])
    }

    // MARK: - Shared placeholder

    private var placeholderRect: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color.white.opacity(0.05))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
            )
            .frame(width: cardWidth, height: height)
    }

    // MARK: - Drag (top waste card)

    private var isDraggingWaste: Bool {
        if case .waste? = dragModel.source { return true }
        return false
    }

    private func wasteDragGesture(top: Card) -> some Gesture {
        DragGesture(minimumDistance: 6, coordinateSpace: .named(BoardSpace.name))
            .onChanged { value in
                if !dragModel.isDragging {
                    dragModel.begin(.waste, cards: [top], cardWidth: cardWidth, at: value.location)
                } else {
                    dragModel.move(to: value.location)
                }
            }
            .onEnded { _ in dragModel.end() }
    }
}
