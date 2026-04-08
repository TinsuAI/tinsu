import SwiftUI

// MARK: - Generate Key Step
struct GenerateKeySetupStep: View {
    @ObservedObject var viewModel: SetupObservableViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Generate SSH Key")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)
            Text("An Ed25519 key pair will be generated and stored securely on this device.")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurfaceVariant)

            Spacer(minLength: 16)

            if let alias = viewModel.sshKeyAlias {
                // Success state
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 48))
                        .tinsuIcon(color: TinsuColors.success)

                    Text("Key Generated")
                        .font(TinsuTypography.title)
                        .foregroundColor(TinsuColors.onSurface)

                    Text(alias)
                        .font(TinsuTypography.code)
                        .foregroundColor(TinsuColors.primary)
                }
                .frame(maxWidth: .infinity)
                .padding(TinsuSpacing.cardPadding)
                .background(TinsuColors.surfaceVariant)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Spacer()

                Button("Next") {
                    viewModel.nextStep()
                }
                .primaryButtonStyle()
                .frame(maxWidth: .infinity)
                .frame(minHeight: TinsuSpacing.minTouchTarget)
            } else {
                Button("Generate Ed25519 Key") {
                    viewModel.generateKey()
                }
                .primaryButtonStyle()
                .frame(maxWidth: .infinity)
                .frame(minHeight: TinsuSpacing.minTouchTarget)

                Text("Ed25519 is the recommended key type — faster and more secure than RSA.")
                    .font(TinsuTypography.label)
                    .foregroundColor(TinsuColors.onSurfaceVariant)
            }
        }
        .padding(.horizontal, TinsuSpacing.contentMargin)
        .padding(.vertical, 24)
    }
}

// MARK: - Preview
struct GenerateKeySetupStep_Previews: PreviewProvider {
    static var previews: some View {
        GenerateKeySetupStep(viewModel: SetupObservableViewModel())
            .preferredColorScheme(.dark)
    }
}
