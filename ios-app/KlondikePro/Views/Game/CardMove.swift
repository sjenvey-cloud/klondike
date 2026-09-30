import SwiftUI

/// Identifies where a dragged card (or tableau sub-stack) came from, so a drop can
/// be resolved into the right GameStore move. Enables non-default moves the
/// single-tap auto-move can't express (e.g. a black 5 onto a specific red 6).
struct CardMove {
    enum Source: Hashable {
        case waste
        case tableau(col: Int, idx: Int)   // idx = top of the sub-stack being moved
        case foundation(slot: Int)
    }
    let source: Source
}

/// A place a card can be dropped.
enum DropTarget: Hashable {
    case column(Int)
    case foundation(Int)
}

/// Shared name for the board coordinate space — drag locations and drop-zone frames
/// are all measured in it so hit-testing lines up.
enum BoardSpace { static let name = "klondikeBoard" }

// MARK: - Drop-zone frame collection

struct DropZonePreferenceKey: PreferenceKey {
    static let defaultValue: [DropTarget: CGRect] = [:]
    static func reduce(value: inout [DropTarget: CGRect], nextValue: () -> [DropTarget: CGRect]) {
        value.merge(nextValue()) { _, new in new }
    }
}

extension View {
    /// Reports this view's frame as a drop zone for `target`, in GLOBAL (screen)
    /// coordinates. Global is used — rather than a named board space — so drop
    /// detection stays correct even when the tableau sits inside a scrollable
    /// ScrollView (the shorter Daily board), where named-space frames for content
    /// inside the scroll view don't line up with the finger location.
    func dropZone(_ target: DropTarget) -> some View {
        background(
            GeometryReader { geo in
                Color.clear.preference(
                    key: DropZonePreferenceKey.self,
                    value: [target: geo.frame(in: .global)]
                )
            }
        )
    }
}

// MARK: - Drag model

/// Single source of truth for a card drag. The board overlay reads this to render
/// the lifted card(s) on top — always solid, following the finger — while the
/// source card(s) hide underneath. This gives the instant, smooth feel of a native
/// card game, which SwiftUI's `.draggable` (press delay + translucent snapshot)
/// can't.
@Observable
final class BoardDragModel {

    private(set) var source: CardMove.Source?
    private(set) var cards: [Card] = []
    private(set) var cardWidth: CGFloat = 0
    var location: CGPoint = .zero

    /// Drop-zone frames in board space, updated from the preference.
    var dropZones: [DropTarget: CGRect] = [:]
    /// Resolve a completed drop into a GameStore move (set by BoardView).
    var onDrop: ((CardMove.Source, DropTarget) -> Void)?
    /// Drag ended over no valid zone.
    var onMiss: (() -> Void)?

    var isDragging: Bool { source != nil }

    func begin(_ source: CardMove.Source, cards: [Card], cardWidth: CGFloat, at point: CGPoint) {
        self.source = source
        self.cards = cards
        self.cardWidth = cardWidth
        self.location = point
    }

    func move(to point: CGPoint) { location = point }

    func end() {
        defer { reset() }
        guard let src = source else { return }
        if let target = zone(at: location) {
            onDrop?(src, target)
        } else {
            onMiss?()
        }
    }

    func reset() { source = nil; cards = [] }

    /// The drop zone under `p`. Prefer foundations (smaller, on top) before columns.
    private func zone(at p: CGPoint) -> DropTarget? {
        for (t, r) in dropZones where isFoundation(t) && r.contains(p) { return t }
        for (t, r) in dropZones where !isFoundation(t) && r.contains(p) { return t }
        return nil
    }

    private func isFoundation(_ t: DropTarget) -> Bool {
        if case .foundation = t { return true }
        return false
    }
}
