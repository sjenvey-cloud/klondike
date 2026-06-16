import SwiftUI
import UniformTypeIdentifiers

/// Drag payload identifying where a dragged card (or tableau sub-stack) came from,
/// so a drop target can ask the GameStore to make that specific move. This is what
/// enables non-default moves the single-tap auto-move can't express — e.g. dropping
/// a black 5 on the right-hand red 6 of two.
struct CardMove: Codable, Transferable {

    enum Source: Codable, Hashable {
        case waste
        case tableau(col: Int, idx: Int)   // idx = top of the sub-stack being moved
        case foundation(slot: Int)
    }

    let source: Source

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .json)
    }
}
