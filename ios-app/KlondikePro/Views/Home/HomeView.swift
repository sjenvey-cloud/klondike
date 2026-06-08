import SwiftUI

/// Home screen — draw mode selector, New Game button, resume banner.
/// Full game integration completed Sprint iOS-4.
struct HomeView: View {

    let gameStore: GameStore
    @Binding var selectedTab: AppTab

    @Environment(AuthStore.self) private var authStore
    @State private var drawMode: DrawMode = DrawMode(rawValue: UserDefaults.standard.string(forKey: "klondike_draw_mode") ?? "draw3") ?? .draw3
    @State private var activeSession: ActiveSessionItem?
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

                    // ── Resume banner (DEV-338: cross-device) ─────────────
                    if let active = activeSession {
                        ResumeBanner(
                            session: active,
                            onResume: {
                                Task {
                                    await gameStore.resumeGame(item: active)
                                    selectedTab = .game
                                }
                            },
                            onNewHand: {
                                Task {
                                    // Abandon the in-progress hand, then deal a fresh one.
                                    await gameStore.resumeGame(item: active)
                                    await gameStore.abandonSession()
                                    await gameStore.newGame(drawMode: drawMode.rawValue)
                                    activeSession = nil
                                    selectedTab = .game
                                }
                            }
                        )
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
                        Task {
                            await gameStore.newGame(drawMode: drawMode.rawValue)
                            selectedTab = .game
                        }
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
        // DEV-252: endpoint returns { daily, random } — surface the random session on Home
        if let response: ActiveSessionsResponse = try? await APIClient.shared.get("/api/v1/sessions/active") {
            activeSession = response.random
        }
    }
}

// MARK: - Resume Banner

private struct ResumeBanner: View {
    let session: ActiveSessionItem
    var onResume: () -> Void
    var onNewHand: () -> Void

    private var timeLabel: String {
        String(format: "%d:%02d", session.timeSeconds / 60, session.timeSeconds % 60)
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Game in Progress")
                        .font(.subheadline.bold())
                    Text("\(session.moves) moves · \(timeLabel) · \(session.drawMode.uppercased())")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundStyle(.yellow)
            }

            HStack(spacing: 10) {
                Button(action: onResume) {
                    Label("Resume", systemImage: "play.fill")
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(.yellow)
                .foregroundStyle(.black)

                Button(action: onNewHand) {
                    Text("New Hand")
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.bordered)
                .tint(.secondary)
            }
        }
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.yellow.opacity(0.4)))
        .padding(.horizontal)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Game in progress: \(session.moves) moves. Resume or deal a new hand.")
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
