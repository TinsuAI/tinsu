import SwiftUI

// MARK: - Test Connection Step
struct TestConnectionSetupStep: View {
    @ObservedObject var viewModel: SetupObservableViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Test Connection")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)
            Text("Verify that your SSH key is properly configured and the connection works.")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurfaceVariant)

            Spacer(minLength: 8)

            if viewModel.isTesting {
                // Testing state
                VStack(spacing: 16) {
                    ProgressView()
                        .tint(TinsuColors.primary)
                        .scaleEffect(1.2)
                    Text("Testing connection...")
                        .font(TinsuTypography.body)
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 48)

            } else if viewModel.testSuccess {
                // Success state
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 48))
                        .tinsuIcon(color: TinsuColors.success)

                    Text("Connection Successful")
                        .font(TinsuTypography.title)
                        .foregroundColor(TinsuColors.onSurface)

                    if let auth = viewModel.testAuthenticatedAs {
                        Text("Authenticated as \(auth)")
                            .font(TinsuTypography.code)
                            .foregroundColor(TinsuColors.primary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(TinsuSpacing.cardPadding)
                .background(TinsuColors.surfaceVariant)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Spacer()

                Button("Next") {
                    viewModel.proceedAfterTestSuccess()
                }
                .primaryButtonStyle()
                .frame(maxWidth: .infinity)
                .frame(minHeight: TinsuSpacing.minTouchTarget)

            } else if let error = viewModel.testError {
                // Failure state
                VStack(spacing: 12) {
                    Image(systemName: "xmark.circle")
                        .font(.system(size: 48))
                        .tinsuIcon(color: TinsuColors.error)

                    Text("Connection Failed")
                        .font(TinsuTypography.title)
                        .foregroundColor(TinsuColors.error)

                    Text(error)
                        .font(TinsuTypography.body)
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(TinsuSpacing.cardPadding)
                .background(TinsuColors.surfaceVariant)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                if !viewModel.testHints.isEmpty {
                    Text("Troubleshooting")
                        .font(TinsuTypography.title)
                        .foregroundColor(TinsuColors.onBackground)

                    ForEach(viewModel.testHints, id: \.self) { hint in
                        Text(hint)
                            .font(TinsuTypography.body)
                            .foregroundColor(TinsuColors.onSurfaceVariant)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(TinsuColors.surfaceVariant)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }

                Spacer()

                Button("Retry") {
                    viewModel.retryTest()
                    viewModel.testConnection()
                }
                .primaryButtonStyle()
                .frame(maxWidth: .infinity)
                .frame(minHeight: TinsuSpacing.minTouchTarget)

            } else {
                // Idle state
                VStack(alignment: .leading, spacing: 12) {
                    Text("Ready to test your connection to:")
                        .font(TinsuTypography.body)
                        .foregroundColor(TinsuColors.onSurface)

                    Text("\(viewModel.username)@\(viewModel.host):\(viewModel.port)")
                        .font(TinsuTypography.code)
                        .foregroundColor(TinsuColors.primary)
                        .padding(TinsuSpacing.cardPadding)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(TinsuColors.surfaceVariant)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Spacer()

                Button("Test Connection") {
                    viewModel.testConnection()
                }
                .primaryButtonStyle()
                .frame(maxWidth: .infinity)
                .frame(minHeight: TinsuSpacing.minTouchTarget)
            }
        }
        .padding(.horizontal, TinsuSpacing.contentMargin)
        .padding(.vertical, 24)
    }
}

// MARK: - Preview
struct TestConnectionSetupStep_Previews: PreviewProvider {
    static var previews: some View {
        TestConnectionSetupStep(viewModel: SetupObservableViewModel())
            .preferredColorScheme(.dark)
    }
}
