import SwiftUI
import Shared

/// SwiftUI view for discovering and selecting remote TinSu projects.
struct ProjectDiscoveryView: View {
    @StateObject private var viewModel: ProjectObservableViewModel
    private let onProjectSelected: (ProjectInfo) -> Void

    init(
        onProjectSelected: @escaping (ProjectInfo) -> Void = { _ in }
    ) {
        self._viewModel = StateObject(wrappedValue: ProjectObservableViewModel())
        self.onProjectSelected = onProjectSelected
    }

    var body: some View {
        Group {
            switch viewModel.uiState {
            case is ProjectUiState.Idle:
                loadingView
                    .onAppear { viewModel.discoverProjects() }

            case is ProjectUiState.Loading:
                loadingView

            case let loaded as ProjectUiState.ProjectsLoaded:
                if loaded.projects.isEmpty && loaded.selectedProject == nil {
                    emptyState
                } else {
                    projectList(loaded)
                }

            case let error as ProjectUiState.Error:
                errorState(error)

            default:
                loadingView
            }
        }
        .navigationTitle("Select Project")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(Material.bar, for: .navigationBar)
        .toolbar {
            if viewModel.uiState is ProjectUiState.ProjectsLoaded {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { viewModel.refreshProjects() }) {
                        Image(systemName: "arrow.clockwise")
                            .tinsuIcon()
                    }
                }
            }
        }
    }

    // MARK: - Loading
    private var loadingView: some View {
        VStack(spacing: TinsuSpacing.contentMargin) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 12)
                    .fill(TinsuColors.surfaceVariant)
                    .frame(height: 72)
                    .shimmer()
            }
            .padding(.horizontal, TinsuSpacing.contentMargin)
            Spacer()
        }
        .padding(.top, 20)
        .background(TinsuColors.background)
    }

    // MARK: - Project List
    private func projectList(_ state: ProjectUiState.ProjectsLoaded) -> some View {
        List {
            ForEach(state.projects, id: \.path) { project in
                ProjectRow(
                    project: project,
                    isSelected: project.path == state.selectedProject?.path,
                    onTap: {
                        viewModel.selectProject(project: project)
                        onProjectSelected(project)
                    }
                )
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.plain)
        .background(TinsuColors.background)
        .refreshable { viewModel.refreshProjects() }
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 24) {
            Image(systemName: "folder.badge.questionmark")
                .font(.system(size: 64))
                .foregroundColor(TinsuColors.onSurfaceVariant)

            Text("No TinSu Projects Found")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)

            Text("Make sure your remote PC has TinSu projects with an _bmad-output directory in the project root.")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurfaceVariant)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Button("Refresh") {
                viewModel.refreshProjects()
            }
            .primaryButtonStyle()
            .frame(minHeight: TinsuSpacing.minTouchTarget)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TinsuColors.background)
    }

    // MARK: - Error State
    private func errorState(_ error: ProjectUiState.Error) -> some View {
        VStack(spacing: 24) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundColor(TinsuColors.error)

            Text(error.isNotFoundError ? "No Projects Found" : "Discovery Failed")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)

            Text(error.message)
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurfaceVariant)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Button("Retry") {
                viewModel.refreshProjects()
            }
            .secondaryButtonStyle()
            .frame(minHeight: TinsuSpacing.minTouchTarget)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TinsuColors.background)
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        ProjectDiscoveryView()
    }
    .preferredColorScheme(.dark)
}
