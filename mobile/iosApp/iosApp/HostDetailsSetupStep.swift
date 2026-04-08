import SwiftUI

// MARK: - Host Details Step
struct HostDetailsSetupStep: View {
    @ObservedObject var viewModel: SetupObservableViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Enter Host Details")
                    .font(TinsuTypography.headline)
                    .foregroundColor(TinsuColors.onBackground)
                Text("Provide the SSH connection details for your remote PC.")
                    .font(TinsuTypography.body)
                    .foregroundColor(TinsuColors.onSurfaceVariant)

                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Host")
                            .font(TinsuTypography.label)
                            .foregroundColor(TinsuColors.onSurfaceVariant)
                        TextField("e.g. 192.168.1.100 or myserver.com", text: $viewModel.host)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(TinsuColors.surfaceVariant)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(TinsuColors.outline, lineWidth: 1)
                            )
                            .foregroundColor(TinsuColors.onSurface)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Port")
                            .font(TinsuTypography.label)
                            .foregroundColor(TinsuColors.onSurfaceVariant)
                        TextField("22", value: $viewModel.port, format: .number)
                            .textFieldStyle(.plain)
                            .keyboardType(.numberPad)
                            .padding(12)
                            .background(TinsuColors.surfaceVariant)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(TinsuColors.outline, lineWidth: 1)
                            )
                            .foregroundColor(TinsuColors.onSurface)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Username")
                            .font(TinsuTypography.label)
                            .foregroundColor(TinsuColors.onSurfaceVariant)
                        TextField("e.g. root or ubuntu", text: $viewModel.username)
                            .textFieldStyle(.plain)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .padding(12)
                            .background(TinsuColors.surfaceVariant)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(TinsuColors.outline, lineWidth: 1)
                            )
                            .foregroundColor(TinsuColors.onSurface)
                    }
                }

                Spacer(minLength: TinsuSpacing.contentMargin)

                Button("Next") {
                    viewModel.nextStep()
                }
                .primaryButtonStyle()
                .frame(maxWidth: .infinity)
                .frame(minHeight: TinsuSpacing.minTouchTarget)
                .disabled(viewModel.host.isEmpty || viewModel.username.isEmpty || viewModel.port < 1 || viewModel.port > 65535)
            }
            .padding(.horizontal, TinsuSpacing.contentMargin)
            .padding(.vertical, 24)
        }
    }
}

// MARK: - Preview
struct HostDetailsSetupStep_Previews: PreviewProvider {
    static var previews: some View {
        HostDetailsSetupStep(viewModel: SetupObservableViewModel())
            .preferredColorScheme(.dark)
    }
}
