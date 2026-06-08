import Foundation

// MARK: - Suit

enum Suit: Int, CaseIterable, CustomStringConvertible {
    case clubs    = 0
    case diamonds = 1
    case hearts   = 2
    case spades   = 3

    var description: String {
        switch self {
        case .clubs:    return "♣"
        case .diamonds: return "♦"
        case .hearts:   return "♥"
        case .spades:   return "♠"
        }
    }

    var name: String {
        switch self {
        case .clubs:    return "Clubs"
        case .diamonds: return "Diamonds"
        case .hearts:   return "Hearts"
        case .spades:   return "Spades"
        }
    }

    var isRed: Bool { self == .diamonds || self == .hearts }

    var accessibilityName: String { name }

    /// Single-letter suit code used in card-art filenames (matches the web).
    var code: String {
        switch self {
        case .clubs:    return "C"
        case .diamonds: return "D"
        case .hearts:   return "H"
        case .spades:   return "S"
        }
    }
}

// MARK: - Rank

enum Rank: Int, CaseIterable, CustomStringConvertible {
    case ace   = 1
    case two   = 2, three, four, five, six, seven, eight, nine, ten
    case jack  = 11
    case queen = 12
    case king  = 13

    var description: String {
        switch self {
        case .ace:   return "A"
        case .jack:  return "J"
        case .queen: return "Q"
        case .king:  return "K"
        default:     return "\(rawValue)"
        }
    }

    var fullName: String {
        switch self {
        case .ace:   return "Ace"
        case .jack:  return "Jack"
        case .queen: return "Queen"
        case .king:  return "King"
        default:     return description
        }
    }
}

// MARK: - Card

/// Immutable card value. `id` matches the integer IDs used by the backend:
///  1–13  = Clubs (Ace → King)
/// 14–26  = Diamonds
/// 27–39  = Hearts
/// 40–52  = Spades
struct Card: Equatable, Hashable, Identifiable, CustomStringConvertible {

    let id: Int
    let suit: Suit
    let rank: Rank
    var isFaceUp: Bool

    // MARK: Init from backend id (1-52)

    init?(id: Int, isFaceUp: Bool = false) {
        guard (1...52).contains(id) else { return nil }
        self.id = id
        let suitIndex = (id - 1) / 13
        let rankValue = (id - 1) % 13 + 1
        guard let suit = Suit(rawValue: suitIndex),
              let rank = Rank(rawValue: rankValue) else { return nil }
        self.suit = suit
        self.rank = rank
        self.isFaceUp = isFaceUp
    }

    // MARK: Descriptions

    var description: String { "\(rank)\(suit)" }

    /// e.g. "7 of Hearts"
    var fullName: String { "\(rank.fullName) of \(suit.name)" }

    /// Accessibility string for VoiceOver
    var accessibilityLabel: String { fullName }

    // MARK: Helpers

    var isRed: Bool { suit.isRed }

    /// Card-art filename stem, e.g. "A_H", "10_C", "K_S" — matches the web's
    /// `/cards/.../{rank}_{suit}.png` assets so both platforms share the artwork.
    var imageCode: String { "\(rank.description)_\(suit.code)" }

    /// Returns true if this card can be placed on top of `other` in a tableau column.
    /// Rule: opposite colour, rank exactly one lower.
    func canStackOnTableau(_ other: Card) -> Bool {
        isRed != other.isRed && rank.rawValue == other.rank.rawValue - 1
    }

    /// Returns true if this card can be placed on the foundation for `suit`.
    /// The foundation accepts Ace first, then ascending same-suit.
    func canPlaceOnFoundation(topCard: Card?) -> Bool {
        guard suit == (topCard?.suit ?? suit) else { return false }
        if let top = topCard {
            return rank.rawValue == top.rank.rawValue + 1
        } else {
            return rank == .ace
        }
    }
}

// MARK: - Deck

extension Card {
    /// Standard 52-card deck, all face down.
    static var fullDeck: [Card] {
        (1...52).compactMap { Card(id: $0, isFaceUp: false) }
    }
}
