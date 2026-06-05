import SwiftUI

/// DEV-301 — Friend-invite accept screen, opened via the
/// `klondikepro://friends/invite/{token}` deep link.
///
/// Self-contained: previews and accepts the invite directly through APIClient
/// so it can be presented from the app root without store plumbing.
struct AcceptInviteView: View {

    let token: String
    var onDismiss: () -> Void

    @State private var inviterName: String?
    @State private var state: ViewState = .loading
    @State private var errorText: String?

    enum ViewState { case loading, preview, accepting, accepted, failed }

    var body: some View {
        ZStack {
            Color(red: 0.05, green: 0.07, blue: 0.10).ignoresSafeArea()

            VStack(spacing: 20) {
                Image(systemName: state == .accepted ? "person.2.fill" : "person.crop.circle.badge.plus")
                    .font(.system(size: 56))
                    .foregroundStyle(.yellow)

                switch state {
                case .loading:
                    ProgressView().tint(.yellow)
                    Text("Loading invite…").foregroundStyle(.white.opacity(0.6))

                case .preview:
                    Text("\(inviterName ?? "Someone") invited you")
                        .font(.title3.bold()).foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text("Accept to add each other as friends on Klondike Pro.")
                        .font(.subheadline).foregroundStyle(.white.opacity(0.5))
                        .multilineTextAlignment(.center).padding(.horizontal, 32)
                    Button {
                        Task { await accept() }
                    } label: {
                        Text("Accept Invite")
                            .font(.headline).foregroundStyle(.black)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(Color.yellow).clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(.horizontal, 32)

                case .accepting:
                    ProgressView().tint(.yellow)
                    Text("Accepting…").foregroundStyle(.white.opacity(0.6))

                case .accepted:
                    Text("You're now friends with \(inviterName ?? "your inviter")!")
                        .font(.title3.bold()).foregroundStyle(.white)
                        .multilineTextAlignment(.center).padding(.horizontal, 32)

                case .failed:
                    Text(errorText ?? "This invite is no longer valid.")
                        .font(.subheadline).foregroundStyle(.white.opacity(0.6))
                        .multilineTextAlignment(.center).padding(.horizontal, 32)
                }

                if state == .accepted || state == .failed {
                    Button("Done") { onDismiss() }
                        .font(.headline).foregroundStyle(.yellow)
                        .padding(.top, 8)
                }
            }
            .padding()
            .overlay(alignment: .topTrailing) {
                Button { onDismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2).foregroundStyle(.white.opacity(0.3))
                }
                .padding()
            }
        }
        .task { await loadPreview() }
    }

    private func loadPreview() async {
        do {
            let preview: InvitePreviewResponse = try await APIClient.shared.get(
                "/api/v1/friends/invites/preview/\(token)"
            )
            inviterName = preview.inviterDisplayName
            state = .preview
        } catch {
            errorText = "This invite has expired or already been used."
            state = .failed
        }
    }

    private func accept() async {
        state = .accepting
        do {
            try await APIClient.shared.postVoid("/api/v1/friends/invite/\(token)/accept")
            state = .accepted
        } catch {
            errorText = "Couldn't accept this invite. It may have expired."
            state = .failed
        }
    }
}
