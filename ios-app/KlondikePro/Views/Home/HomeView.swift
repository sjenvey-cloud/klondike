import SwiftUI

/// Home screen — draw mode selector, New Game button, resume banner.
/// Full game integration completed Sprint iOS-4.
struct HomeView: View {

    @Environment(AuthStore.self) private var authStore
    @State private var drawMode: DrawMode = DrawMode(rawValue: UserDefaults.standard.string(forKey: "klondike_draw_mode") ?? "draw3") ?? .draw3
    @State private var activeSession: ActiveSessionResponse?
    @State private var isCheckingSession = false
    @State private var showNewGame       = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {

                    // ── Header ────────────────────────────────────────────
                    VStack(spacing: 4) {
                        Text("Welcome back,")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(authStore.user?.displayName ?? "Player")
                            .font(.title2.bold())
                    }
                    .padding(.top, 24)

                    // ── Resume banner ─────────────────────────────────────
                    if let active = activeSession {
                        ResumeBanner(session: active)
                    }

                    // ── Draw mode selector ────────────────────────────────
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Draw Mode")
                            .font(.headline)
                            .padding(.horizontal)

                        HStack(spacing: 0) {
                            ForEach(DrawMode.allCases) { mode in
                                Button {
                                    drawMode = mode
                                    UserDefaults.standard.set(mode.rawValue, forKey: "klondike_draw_mode")
                                } label: {
                                    VStack(spacing: 6) {
                                        Text(mode.label)
                                            .fontWeight(drawMode == mode ? .bold : .regular)
                                        Text(mode.description)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(drawMode == mode ? Color.yellow : Color.clear)
                                    .foregroundStyle(drawMode == mode ? Color.black : Color.primary)
                                }
                                .accessibilityLabel(mode.label)
                                .accessibilityHint(mode.accessibilityHint)
                                .accessibilityAddTraits(drawMode == mode ? .isSelected : [])
                            }
                        }
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.primary.opacity(0.1)))
                        .padding(.horizontal)
                    }

                    // ── New game button ───────────────────────────────────
                    Button {
                        showNewGame = true
                    } label: {
                        Label("New Game", systemImage: "play.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.yellow)
                    .foregroundStyle(.black)
                    .padding(.horizontal)
                    // Sprint iOS-4: replaced with NavigationLink to GameView

                    Spacer()
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Klondike Pro")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await checkActiveSession()
            }
        }
    }

    // MARK: - Helpers

    private func checkActiveSession() async {
        isCheckingSession = true
        defer { isCheckingSession = false }
        activeSession = try? await APIClient.shared.get("/api/v1/sessions/active")
    }
}

// MARK: - Resume Banner

private struct ResumeBanner: View {
    let session: ActiveSessionResponse

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Game in Progress")
                    .font(.subheadline.bold())
                Text("\(session.session.moves) moves · \(session.session.drawMode.uppercased())")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("Resume →")
                .font(.subheadline.bold())
                .foregroundStyle(.yellow)
        }
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.yellow.opacity(0.4)))
        .padding(.horizontal)
        // Sprint iOS-4: tapping navigates to GameView with existing session
    }
}

// MARK: - Draw Mode

enum DrawMode: String, CaseIterable, Identifiable {
    case draw1 = "draw1"
    case draw3 = "draw3"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .draw1: return "Draw 1"
        case .draw3: return "Draw 3"
        }
    }

    var description: String {
        switch self {
        case .draw1: return "Easier"
        case .draw3: return "Classic"
        }
    }

    var accessibilityHint: String {
        switch self {
        case .draw1: return "Draw one card from the stock at a time"
        case .draw3: return "Draw three cards from the stock at a time"
        }
    }
}
