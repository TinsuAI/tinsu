import SwiftUI
import Combine
import Shared

/// Observable wrapper for the shared ProjectViewModel, bridging Kotlin StateFlow to SwiftUI.
@MainActor
class ProjectObservableViewModel: ObservableObject {
    @Published var uiState: ProjectUiState = ProjectUiState.Idle()

    private let viewModel: Shared.ProjectViewModel
    private var pollTimer: Timer?

    init() {
        do {
            viewModel = try KoinHelperKt.getProjectViewModel()
        } catch {
            fatalError("Koin failed to create ProjectViewModel: \(error)")
        }
    }

    func discoverProjects() {
        viewModel.discoverProjects(executor: nil)
        startPolling(until: { [weak self] in
            !(self?.viewModel.uiState.value is ProjectUiState.Loading)
        })
    }

    func selectProject(project: ProjectInfo) {
        viewModel.selectProject(project: project)
        refreshState()
    }

    func refreshProjects() {
        viewModel.refreshProjects()
        startPolling(until: { [weak self] in
            !(self?.viewModel.uiState.value is ProjectUiState.Loading)
        })
    }

    private func startPolling(until condition: @escaping () -> Bool) {
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            Task { @MainActor in
                if condition() {
                    timer.invalidate()
                    self.pollTimer = nil
                    self.refreshState()
                }
            }
        }
    }

    private func refreshState() {
        uiState = viewModel.uiState.value as? ProjectUiState ?? ProjectUiState.Idle()
    }

    deinit {
        pollTimer?.invalidate()
    }
}
