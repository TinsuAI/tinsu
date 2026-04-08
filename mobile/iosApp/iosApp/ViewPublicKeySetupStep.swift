import SwiftUI

// MARK: - View Public Key Step
struct ViewPublicKeySetupStep: View {
    @ObservedObject var viewModel: SetupObservableViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your Public Key")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)
            Text("Copy this key and add it to your remote machine's authorized_keys file.")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurfaceVariant)

            // Key display
            ScrollView {
                Text(viewModel.publicKeyText ?? "No key generated yet.")
                    .font(TinsuTypography.code)
                    .foregroundColor(viewModel.publicKeyText != nil ? TinsuColors.onSurface : TinsuColors.onSurfaceVariant)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(TinsuSpacing.cardPadding)
            .background(TinsuColors.surfaceVariant)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .frame(maxHeight: .infinity)

            Spacer(minLength: 8)

            Button("Copy to Clipboard") {
                viewModel.copyPublicKey()
            }
            .primaryButtonStyle()
            .frame(maxWidth: .infinity)
            .frame(minHeight: TinsuSpacing.minTouchTarget)
            .disabled(viewModel.publicKeyText == nil)

            Button("I've Copied My Key") {
                viewModel.nextStep()
            }
            .secondaryButtonStyle()
            .frame(maxWidth: .infinity)
            .frame(minHeight: TinsuSpacing.minTouchTarget)
            .disabled(viewModel.publicKeyText == nil)
        }
        .padding(.horizontal, TinsuSpacing.contentMargin)
        .padding(.vertical, 24)
    }
}

// MARK: - Preview
struct ViewPublicKeySetupStep_Previews: PreviewProvider {
    static var previews: some View {
        ViewPublicKeySetupStep(viewModel: SetupObservableViewModel())
            .preferredColorScheme(.dark)
    }
}
