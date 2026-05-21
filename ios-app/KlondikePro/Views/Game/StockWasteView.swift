import SwiftUI

/// Displays the stock (draw pile) and waste (discard) piles side by side.
struct StockWasteView: View {

    let store: GameStore
    let cardWidth: CGFloat
    var onWasteTap: () -> Void
    var onStockTap: () -> Void

    private var height: CGFloat { cardWidth * 1.4 }
    private var spacing: CGFloat { cardWidth * 0.25 }

    var body: some View {
        HStack(spacing: spacing) {
            stockPile
            wastePile
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

    private var wastePile: some View {
        let wasteTop = store.state?.wasteTop

        return ZStack {
            placeholderRect

            if let card = wasteTop {
                CardView(card: card, width: cardWidth)
            } else {
                // Empty placeholder with dotted border
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(
                        style: StrokeStyle(lineWidth: 1, dash: [4])
                    )
                    .foregroundStyle(Color.secondary.opacity(0.5))
                    .frame(width: cardWidth, height: height)
            }
        }
        .frame(width: cardWidth, height: height)
        .onTapGesture {
            if wasteTop != nil { onWasteTap() }
        }
        .accessibilityLabel(wasteTop.map { "Waste, top card \($0.accessibilityLabel)" } ?? "Waste, empty")
        .accessibilityAddTraits(wasteTop != nil ? .isButton : [])
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
}
