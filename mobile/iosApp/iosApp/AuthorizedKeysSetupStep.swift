import SwiftUI

// MARK: - Authorized Keys Instructions Step
struct AuthorizedKeysSetupStep: View {
    @ObservedObject var viewModel: SetupObservableViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Add Key to Remote Machine")
                    .font(TinsuTypography.headline)
                    .foregroundColor(TinsuColors.onBackground)
                Text("Add your public key to the remote PC so you can connect without a password.")
                    .font(TinsuTypography.body)
                    .foregroundColor(TinsuColors.onSurfaceVariant)

                // Quick method
                Text("Quick Method")
                    .font(TinsuTypography.title)
                    .foregroundColor(TinsuColors.onBackground)

                Text("ssh-copy-id -i ~/.ssh/tinsu_key.pub \(viewModel.username)@\(viewModel.host)")
                    .font(TinsuTypography.code)
                    .foregroundColor(TinsuColors.primary)
                    .textSelection(.enabled)
                    .padding(TinsuSpacing.cardPadding)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(TinsuColors.surfaceVariant)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                // Manual steps
                Text("Manual Steps")
                    .font(TinsuTypography.title)
                    .foregroundColor(TinsuColors.onBackground)

                let steps = [
                    "SSH into your remote machine: ssh \(viewModel.username)@\(viewModel.host)",
                    "Create the .ssh directory: mkdir -p ~/.ssh && chmod 700 ~/.ssh",
                    "Open authorized_keys: nano ~/.ssh/authorized_keys",
                    "Paste your public key on a new line, then save the file",
                    "Set permissions: chmod 600 ~/.ssh/authorized_keys"
                ]

                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Step \(index + 1)")
                            .font(TinsuTypography.code)
                            .foregroundColor(TinsuColors.primary)
                        Text(step)
                            .font(TinsuTypography.code)
                            .foregroundColor(TinsuColors.onSurface)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(TinsuColors.surfaceVariant)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }

                Spacer(minLength: TinsuSpacing.contentMargin)

                Button("I've Added the Key") {
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

// MARK: - Preview
struct AuthorizedKeysSetupStep_Previews: PreviewProvider {
    static var previews: some View {
        AuthorizedKeysSetupStep(viewModel: SetupObservableViewModel())
            .preferredColorScheme(.dark)
    }
}
