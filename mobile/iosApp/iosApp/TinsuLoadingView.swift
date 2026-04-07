import SwiftUI

// MARK: - TinsuLoadingView
/// A Terminal Luxe styled loading card wrapping system ProgressView.
struct TinsuLoadingView: View {
    var label: String = "Loading..."

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(TinsuColors.primary)
                .scaleEffect(1.2)
            Text(label)
                .font(TinsuTypography.label)
                .foregroundColor(TinsuColors.onSurface)
        }
        .padding(TinsuSpacing.cardPadding)
        .background(TinsuColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(TinsuColors.outline, lineWidth: 1)
        )
    }
}

// MARK: - AgentThinkingView
/// Pre-configured loading view for agent thinking / tool-call states.
struct AgentThinkingView: View {
    var body: some View {
        TinsuLoadingView(label: "Agent is thinking...")
    }
}

// MARK: - Previews
struct TinsuLoadingView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            TinsuColors.background
                .ignoresSafeArea()
            AgentThinkingView()
        }
        .preferredColorScheme(.dark)
        .previewDisplayName("Agent Thinking — Dark")
    }
}
