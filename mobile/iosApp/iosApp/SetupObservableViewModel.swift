import SwiftUI
import Combine
import Shared

// MARK: - Observable ViewModel
/// Wraps the shared SetupViewModel for SwiftUI observation.
@MainActor
class SetupObservableViewModel: ObservableObject {
    @Published var currentStep: SetupScreenStep = .welcome
    @Published var isCompleted = false

    // Form state
    @Published var host = ""
    @Published var port = 22
    @Published var username = ""
    @Published var displayName = ""
    @Published var sshKeyAlias: String?
    @Published var publicKeyText: String?
    @Published var isTesting = false
    @Published var testSuccess = false
    @Published var testError: String?
    @Published var testHints: [String] = []
    @Published var testAuthenticatedAs: String?

    private let viewModel = KoinHelperKt.getSetupViewModel()
    private var pollTimer: Timer?

    func nextStep() {
        syncToViewModel()
        viewModel.nextStep()
        syncFromViewModel()
    }

    func previousStep() {
        viewModel.previousStep()
        syncFromViewModel()
    }

    func skipSetup() {
        viewModel.skipSetup()
        isCompleted = true
    }

    func generateKey() {
        viewModel.generateKey(keyType: .ed25519)
        startPolling(interval: 0.1, until: { [weak self] in
            self?.viewModel.sshKeyAlias != nil
        }, onDone: { [weak self] in
            self?.syncFromViewModel()
        })
    }

    func testConnection() {
        syncToViewModel()
        isTesting = true
        testSuccess = false
        testError = nil

        viewModel.testConnection()
        startPolling(interval: 0.2, until: { [weak self] in
            let state = self?.viewModel.uiState.value
            return !(state is SetupUiState.Testing)
        }, onDone: { [weak self] in
            self?.syncFromViewModel()
        })
    }

    func retryTest() {
        viewModel.retryTest()
        testError = nil
        testSuccess = false
        syncFromViewModel()
    }

    func proceedAfterTestSuccess() {
        viewModel.proceedAfterTestSuccess()
        syncFromViewModel()
    }

    func saveConnection() {
        syncToViewModel()
        viewModel.saveConnection()
        startPolling(interval: 0.2, until: { [weak self] in
            let state = self?.viewModel.uiState.value
            return !(state is SetupUiState.Saving)
        }, onDone: { [weak self] in
            self?.syncFromViewModel()
        })
    }

    func copyPublicKey() {
        guard let key = publicKeyText ?? viewModel.getPublicKey() else { return }
        UIPasteboard.general.string = key
    }

    func syncToViewModel() {
        viewModel.setHostDetails(host: host, port: Int32(port), username: username)
        viewModel.setDisplayName(name: displayName)
    }

    private func startPolling(
        interval: TimeInterval,
        until condition: @escaping () -> Bool,
        onDone: @escaping () -> Void
    ) {
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] timer in
            Task { @MainActor in
                if condition() {
                    timer.invalidate()
                    self?.pollTimer = nil
                    onDone()
                }
            }
        }
    }

    private func syncFromViewModel() {
        // Map SetupStep to SetupScreenStep
        let uiState = viewModel.uiState.value
        switch uiState {
        case is SetupUiState.StepActive:
            let step = (uiState as! SetupUiState.StepActive).step
            currentStep = SetupScreenStep(rawValue: step.index) ?? .welcome
        case is SetupUiState.Testing:
            currentStep = .testConnection
            isTesting = true
        case is SetupUiState.TestSuccess:
            currentStep = .testConnection
            testSuccess = true
            isTesting = false
            testAuthenticatedAs = (uiState as! SetupUiState.TestSuccess).sessionInfo.authenticatedAs
        case is SetupUiState.TestFailure:
            currentStep = .testConnection
            isTesting = false
            testError = (uiState as! SetupUiState.TestFailure).message
            testHints = (uiState as! SetupUiState.TestFailure).hints
        case is SetupUiState.Saving:
            currentStep = .saveConnection
        case is SetupUiState.Completed:
            isCompleted = true
        default:
            break
        }

        sshKeyAlias = viewModel.sshKeyAlias
        publicKeyText = viewModel.getPublicKey()
        host = viewModel.host
        port = Int(viewModel.port)
        username = viewModel.username
        displayName = viewModel.displayName
    }

    deinit {
        pollTimer?.invalidate()
    }
}
