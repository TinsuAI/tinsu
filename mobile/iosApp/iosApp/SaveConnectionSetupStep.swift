import SwiftUI

// MARK: - Save Connection Step
struct SaveConnectionSetupStep: View {
    @ObservedObject var viewModel: SetupObservableViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Save Connection")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)
            Text("Give this connection a name so you can easily identify it later.")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurfaceVariant)

            // Name field
            VStack(alignment: .leading, spacing: 4) {
                Text("Connection Name")
                    .font(TinsuTypography.label)
                    .foregroundColor(TinsuColors.onSurfaceVariant)
                TextField("e.g. My Dev Server", text: $viewModel.displayName)
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

            // Summary
            Text("Summary")
                .font(TinsuTypography.title)
                .foregroundColor(TinsuColors.onBackground)

            VStack(alignment: .leading, spacing: 8) {
                SummaryItem(label: "Host", value: viewModel.host)
                SummaryItem(label: "Port", value: "\(viewModel.port)")
                SummaryItem(label: "Username", value: viewModel.username)
                SummaryItem(label: "Key", value: viewModel.sshKeyAlias ?? "Not generated")
            }

            Spacer()

            Button("Save & Connect") {
                viewModel.saveConnection()
            }
            .primaryButtonStyle()
            .frame(maxWidth: .infinity)
            .frame(minHeight: TinsuSpacing.minTouchTarget)
            .disabled(viewModel.displayName.isEmpty || !viewModel.testSuccess)
        }
        .padding(.horizontal, TinsuSpacing.contentMargin)
        .padding(.vertical, 24)
    }
}

// MARK: - Summary Item
struct SummaryItem: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(TinsuTypography.label)
                .foregroundColor(TinsuColors.onSurfaceVariant)
            Text(value)
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurface)
        }
    }
}

// MARK: - Preview
struct SaveConnectionSetupStep_Previews: PreviewProvider {
    static var previews: some View {
        SaveConnectionSetupStep(viewModel: SetupObservableViewModel())
            .preferredColorScheme(.dark)
    }
}
