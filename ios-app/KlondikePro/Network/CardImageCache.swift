import UIKit

/// On-disk cache of card-face artwork so the user's chosen card style stays legible
/// offline. Faces are normally streamed from the CDN via AsyncImage; offline that
/// fails and the board falls back to the plain programmatic face. This pre-downloads
/// the 52 faces for a style and serves them from disk, so offline play keeps the
/// selected design. (Card backs are drawn programmatically, so they need no caching.)
///
/// Thread-safe: NSCache is thread-safe and the disk reads/writes are independent, so
/// the synchronous `image(...)` can be called straight from a SwiftUI `body`.
final class CardImageCache {

    static let shared = CardImageCache()

    private let mem = NSCache<NSString, UIImage>()
    private let dir: URL

    private init() {
        let base = (try? FileManager.default.url(
            for: .cachesDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true)) ?? FileManager.default.temporaryDirectory
        dir = base.appendingPathComponent("card_art", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    // MARK: - Read (synchronous; memory → disk)

    /// The cached face image for a style + card image code, or nil if not cached yet.
    func image(style: String, code: String) -> UIImage? {
        let key = "\(style)/\(code)" as NSString
        if let img = mem.object(forKey: key) { return img }
        guard let data = try? Data(contentsOf: fileURL(style: style, code: code)),
              let img = UIImage(data: data) else { return nil }
        mem.setObject(img, forKey: key)
        return img
    }

    // MARK: - Pre-warm (download + store all 52 faces for a style)

    /// Best-effort: downloads every face for `style` that isn't already cached. Safe to
    /// call repeatedly (cached faces are skipped) and offline (failures are ignored and
    /// retried on the next call).
    func prewarm(style: String) async {
        for id in 1...52 {
            guard let card = Card(id: id, isFaceUp: true) else { continue }
            let code = card.imageCode
            let file = fileURL(style: style, code: code)
            if FileManager.default.fileExists(atPath: file.path) { continue }
            guard let url = CardArt.faceURL(for: card, style: style) else { continue }
            do {
                let (data, resp) = try await URLSession.shared.data(from: url)
                guard (resp as? HTTPURLResponse)?.statusCode == 200,
                      UIImage(data: data) != nil else { continue }
                try? data.write(to: file, options: .atomic)
            } catch {
                // Offline / transient — leave it for the next prewarm.
            }
        }
    }

    // MARK: - Paths

    private func fileURL(style: String, code: String) -> URL {
        // Style + code are ASCII (e.g. "modern", "A_H"); safe as a filename.
        dir.appendingPathComponent("\(style)_\(code).png")
    }
}
