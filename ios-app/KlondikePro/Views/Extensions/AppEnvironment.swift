import SwiftUI

// MARK: - Hex Color Initializer

extension Color {
    /// Initialise from a 6-character hex string — with or without leading "#".
    init(hex: String) {
        let stripped = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var value: UInt64 = 0
        Scanner(string: stripped).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8)  & 0xFF) / 255
        let b = Double( value        & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Felt (board background) colour

private struct FeltColorKey: EnvironmentKey {
    static let defaultValue: Color = Color(red: 0.05, green: 0.07, blue: 0.10)
}

extension EnvironmentValues {
    var feltColor: Color {
        get { self[FeltColorKey.self] }
        set { self[FeltColorKey.self] = newValue }
    }
}

// MARK: - Card back colour

private struct CardBackColorKey: EnvironmentKey {
    static let defaultValue: Color = Color(red: 0.11, green: 0.14, blue: 0.20)
}

extension EnvironmentValues {
    var cardBackColor: Color {
        get { self[CardBackColorKey.self] }
        set { self[CardBackColorKey.self] = newValue }
    }
}
