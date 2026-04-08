import SwiftUI
import Shared

// MARK: - Setup Step
enum SetupScreenStep: Int, CaseIterable {
    case welcome = 0
    case hostDetails = 1
    case generateKey = 2
    case viewPublicKey = 3
    case authorizedKeysInstructions = 4
    case testConnection = 5
    case saveConnection = 6

    static var totalSteps: Int { SetupScreenStep.allCases.count }
}

// MARK: - Setup Flow View
struct SetupFlowView: View {
    @StateObject private var viewModel = SetupObservableViewModel()
    let onComplete: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Progress section
            SetupProgressHeader(
                stepIndex: viewModel.currentStep.rawValue,
                totalSteps: SetupScreenStep.totalSteps
            )

            Divider().background(TinsuColors.outline)

            // Step content
            Group {
                switch viewModel.currentStep {
                case .welcome:
                    WelcomeSetupStep(viewModel: viewModel)
                case .hostDetails:
                    HostDetailsSetupStep(viewModel: viewModel)
                case .generateKey:
                    GenerateKeySetupStep(viewModel: viewModel)
                case .viewPublicKey:
                    ViewPublicKeySetupStep(viewModel: viewModel)
                case .authorizedKeysInstructions:
                    AuthorizedKeysSetupStep(viewModel: viewModel)
                case .testConnection:
                    TestConnectionSetupStep(viewModel: viewModel)
                case .saveConnection:
                    SaveConnectionSetupStep(viewModel: viewModel)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            Divider().background(TinsuColors.outline)

            // Navigation bar
            SetupNavigationBar(
                step: viewModel.currentStep,
                viewModel: viewModel
            )
        }
        .background(TinsuColors.background)
        .onChange(of: viewModel.isCompleted) { completed in
            if completed { onComplete() }
        }
    }
}

// MARK: - Progress Header
struct SetupProgressHeader: View {
    let stepIndex: Int
    let totalSteps: Int

    var body: some View {
        VStack(spacing: 8) {
            Text("Step \(stepIndex + 1) of \(totalSteps)")
                .font(TinsuTypography.code)
                .foregroundColor(TinsuColors.onSurfaceVariant)
            ProgressView(value: Double(stepIndex + 1), total: Double(totalSteps))
                .tint(TinsuColors.primary)
        }
        .padding(.horizontal, TinsuSpacing.contentMargin)
        .padding(.vertical, 12)
    }
}

// MARK: - Navigation Bar
struct SetupNavigationBar: View {
    let step: SetupScreenStep
    let viewModel: SetupObservableViewModel

    var body: some View {
        HStack {
            if step != .welcome {
                Button(action: { viewModel.previousStep() }) {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.backward")
                        Text("Back")
                    }
                }
                .secondaryButtonStyle()
            }

            Spacer()

            if step == .welcome {
                Button("Skip") {
                    viewModel.skipSetup()
                }
                .tertiaryButtonStyle()
            }
        }
        .padding(.horizontal, TinsuSpacing.contentMargin)
        .padding(.vertical, 12)
    }
}

// MARK: - Preview
struct SetupFlowView_Previews: PreviewProvider {
    static var previews: some View {
        SetupFlowView(onComplete: {})
            .preferredColorScheme(.dark)
    }
}
