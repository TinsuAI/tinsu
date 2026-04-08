import SwiftUI

// MARK: - Welcome Step
struct WelcomeSetupStep: View {
    @ObservedObject var viewModel: SetupObservableViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Title
                VStack(alignment: .leading, spacing: 8) {
                    Text("Welcome to TinSu")
                        .font(TinsuTypography.display)
                        .foregroundColor(TinsuColors.onBackground)
                    Text("Connect to your development machines from anywhere.")
                        .font(TinsuTypography.body)
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                }

                // What TinSu does
                VStack(alignment: .leading, spacing: 8) {
                    Text("What TinSu does")
                        .font(TinsuTypography.title)
                        .foregroundColor(TinsuColors.onBackground)
                    Text("TinSu lets you manage remote development sessions, chat with AI agents, review code, and read planning documents — all from your mobile device.")
                        .font(TinsuTypography.body)
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                }

                // Prerequisites card
                VStack(alignment: .leading, spacing: 8) {
                    Text("What you need")
                        .font(TinsuTypography.title)
                        .foregroundColor(TinsuColors.onBackground)

                    VStack(spacing: 16) {
                        PrerequisiteRow(
                            icon: "desktopcomputer",
                            title: "A remote PC with SSH",
                            subtitle: "Linux, macOS, or WSL on Windows"
                        )
                        PrerequisiteRow(
                            icon: "key.fill",
                            title: "SSH access credentials",
                            subtitle: "Username and hostname/IP"
                        )
                        PrerequisiteRow(
                            icon: "macbook.and.iphone",
                            title: "TinSu Desktop (optional)",
                            subtitle: "For full agent management features"
                        )
                    }
                    .padding(TinsuSpacing.cardPadding)
                    .background(TinsuColors.surfaceVariant)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Spacer(minLength: TinsuSpacing.contentMargin)

                // Get Started button
                Button("Get Started") {
                    viewModel.nextStep()
                }
                .primaryButtonStyle()
                .frame(maxWidth: .infinity)
                .frame(minHeight: TinsuSpacing.minTouchTarget)
            }
            .padding(.horizontal, TinsuSpacing.contentMargin)
            .padding(.vertical, 24)
        }
    }
}

// MARK: - Prerequisite Row
struct PrerequisiteRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .tinsuIcon()
                .frame(width: 40, height: 40)
                .background(TinsuColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(TinsuTypography.body)
                    .foregroundColor(TinsuColors.onSurface)
                Text(subtitle)
                    .font(TinsuTypography.label)
                    .foregroundColor(TinsuColors.onSurfaceVariant)
            }
        }
    }
}

// MARK: - Preview
struct WelcomeSetupStep_Previews: PreviewProvider {
    static var previews: some View {
        WelcomeSetupStep(viewModel: SetupObservableViewModel())
            .preferredColorScheme(.dark)
    }
}
