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

// MARK: - Card face style (DEV — cross-platform card art)

private struct CardStyleKey: EnvironmentKey {
    static let defaultValue: String = "classic"
}

extension EnvironmentValues {
    /// "classic" | "modern" | "fantasy" — selects the card-face artwork set.
    var cardStyle: String {
        get { self[CardStyleKey.self] }
        set { self[CardStyleKey.self] = newValue }
    }
}

// MARK: - Card art URLs (shared with the web's /cards assets)

/// Builds CDN URLs for card-face artwork. The PNGs are the same assets the web
/// app uses, served from the API/CloudFront origin, so the styles match exactly.
enum CardArt {

    /// Same origin as the REST API (Info.plist `API_BASE_URL`, CloudFront fallback).
    static let baseURL: String =
        (Bundle.main.infoDictionary?["API_BASE_URL"] as? String)
        ?? "https://d2fbehwb6bp7kq.cloudfront.net"

    /// Asset subfolder for a style: classic = root, modern/fantasy = named folder.
    static func folder(for style: String) -> String {
        switch style {
        case "modern":  return "modern"
        case "fantasy": return "fantasy"
        default:        return ""   // classic
        }
    }

    /// Face-up artwork URL for a card in the given style, e.g.
    /// `…/cards/A_H.png` (classic) or `…/cards/modern/A_H.png`.
    static func faceURL(for card: Card, style: String) -> URL? {
        let dir  = folder(for: style)
        let path = dir.isEmpty ? "/cards/\(card.imageCode).png"
                               : "/cards/\(dir)/\(card.imageCode).png"
        return URL(string: baseURL + path)
    }
}
