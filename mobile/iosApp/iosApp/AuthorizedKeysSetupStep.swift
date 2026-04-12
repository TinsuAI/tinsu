import SwiftUI

// MARK: - Deploy Key Step (automated)
struct AuthorizedKeysSetupStep: View {
    @ObservedObject var viewModel: SetupObservableViewModel
    @State private var password = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Add Key to Server")
                    .font(TinsuTypography.headline)
                    .foregroundColor(TinsuColors.onBackground)
                Text("Enter your SSH password once. Tinsu will add your public key to the server automatically — you won't need a password after this.")
                    .font(TinsuTypography.body)
                    .foregroundColor(TinsuColors.onSurfaceVariant)

                if viewModel.deployKeySuccess {
                    // Success state
                    VStack(spacing: 16) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 48))
                            .tinsuIcon(color: TinsuColors.success)
                        Text("Key Deployed Successfully")
                            .font(TinsuTypography.title)
                            .foregroundColor(TinsuColors.onSurface)
                        Text("Your public key has been added to ~/.ssh/authorized_keys on the remote server.")
                            .font(TinsuTypography.body)
                            .foregroundColor(TinsuColors.onSurfaceVariant)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(TinsuSpacing.cardPadding)
                    .background(TinsuColors.surfaceVariant)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Spacer(minLength: 16)

                    Button("Next") {
                        viewModel.nextStep()
                    }
                    .primaryButtonStyle()
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: TinsuSpacing.minTouchTarget)

                } else {
                    // Password input
                    VStack(alignment: .leading, spacing: 8) {
                        Text("SSH Password")
                            .font(TinsuTypography.label)
                            .foregroundColor(TinsuColors.onSurfaceVariant)
                        SecureField("Enter your SSH password", text: $password)
                            .textContentType(.password)
                            .padding(12)
                            .background(TinsuColors.surfaceVariant)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .foregroundColor(TinsuColors.onSurface)
                    }

                    if let error = viewModel.deployKeyError {
                        Text(error)
                            .font(TinsuTypography.label)
                            .foregroundColor(TinsuColors.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if viewModel.isDeployingKey {
                        HStack(spacing: 12) {
                            ProgressView()
                                .tint(TinsuColors.primary)
                            Text("Adding key to server…")
                                .font(TinsuTypography.body)
                                .foregroundColor(TinsuColors.onSurfaceVariant)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        Button("Deploy Key to Server") {
                            viewModel.deployPublicKey(password: password)
                        }
                        .primaryButtonStyle()
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: TinsuSpacing.minTouchTarget)
                        .disabled(password.isEmpty)
                    }

                    // Manual fallback
                    Button("I'll add it manually") {
                        viewModel.nextStep()
                    }
                    .tertiaryButtonStyle()
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: TinsuSpacing.minTouchTarget)
                }
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
