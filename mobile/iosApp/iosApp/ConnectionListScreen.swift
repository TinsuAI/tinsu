import SwiftUI
import Shared

/// SwiftUI view for the connection list screen matching Android design.
struct ConnectionListScreen: View {
    @State private var viewModel: ConnectionListViewModel
    @State private var showingAddScreen = false
    @State private var editingConnection: ConnectionConfig?
    @State private var deleteConfirmation: ConnectionConfig?

    private let onConnectionClick: (ConnectionConfig) -> Void

    init(
        repository: ConnectionRepository,
        onConnectionClick: @escaping (ConnectionConfig) -> Void
    ) {
        self._viewModel = State(initialValue: ConnectionListViewModel(repository: repository))
        self.onConnectionClick = onConnectionClick
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Main content
            Group {
                if viewModel.uiState.isEmpty {
                    emptyConnectionsState
                } else {
                    connectionList
                }
            }
            .animation(.easeInOut, value: viewModel.uiState.isEmpty)

            // Floating action button
            if !viewModel.uiState.isLoading {
                Button(action: { showingAddScreen = true }) {
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(.white)
                        .frame(width: 56, height: 56)
                        .background(TinsuColors.primary)
                        .clipShape(Circle())
                        .shadow(color: TinsuColors.primary.opacity(0.3), radius: 8, x: 0, y: 4)
                }
                .padding(.trailing, 16)
                .padding(.bottom, 16)
            }
        }
        .navigationTitle("Connections")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingAddScreen) {
            ConnectionEditScreen(
                existingConnection: nil,
                repository: viewModel.repository,
                onSave: {
                    showingAddScreen = false
                    viewModel.loadConnections()
                }
            )
        }
        .sheet(item: $editingConnection) { connection in
            ConnectionEditScreen(
                existingConnection: connection,
                repository: viewModel.repository,
                onSave: {
                    editingConnection = nil
                    viewModel.loadConnections()
                }
            )
        }
        .alert("Delete Connection?", isPresented: .constant(deleteConfirmation != nil)) {
            Button("Cancel", role: .cancel) {
                deleteConfirmation = nil
            }
            Button("Delete", role: .destructive) {
                if let connection = deleteConfirmation {
                    viewModel.deleteConnection(id: connection.id ?? "")
                }
                deleteConfirmation = nil
            }
        } message: {
            if let connection = deleteConfirmation {
                Text("Are you sure you want to delete \"\(connection.displayName)\"? This action cannot be undone.")
            }
        }
    }

    // MARK: - Connection List
    private var connectionList: some View {
        List {
            ForEach(viewModel.uiState.connections, id: \.id) { connection in
                ConnectionCardView(
                    connection: connection,
                    onEdit: { editingConnection = connection },
                    onDelete: { deleteConfirmation = connection }
                )
                .onTapGesture {
                    onConnectionClick(connection)
                }
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                .listRowBackground(Color.clear)
            }
            .onMove { source, destination in
                handleMove(from: source, to: destination)
            }
        }
        .listStyle(.plain)
        .background(TinsuColors.background)
        .refreshable {
            viewModel.loadConnections()
        }
    }

    // MARK: - Empty State
    private var emptyConnectionsState: some View {
        VStack(spacing: 24) {
            Image(systemName: "server")
                .font(.system(size: 64))
                .foregroundColor(TinsuColors.onSurfaceVariant)

            Text("No Connections Yet")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)

            Text("Add your first remote PC connection to get started.")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurfaceVariant)
                .multilineTextAlignment(.center)

            Button("Add Connection") {
                showingAddScreen = true
            }
            .primaryButtonStyle()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TinsuColors.background)
    }

    // MARK: - Drag to Reorder
    private func handleMove(from source: IndexSet, to destination: Int) {
        var connections = viewModel.uiState.connections
        connections.move(fromOffsets: source, toOffset: destination)

        let ids = connections.map { $0.id ?? "" }
        viewModel.reorderConnections(ids: ids)
    }
}

// MARK: - Observable ViewModel Wrapper
@MainActor
class ConnectionListViewModel: ObservableObject {
    private let repository: ConnectionRepository
    private var viewModel: Shared.ConnectionListViewModel

    @Published var uiState: ConnectionListUiState = ConnectionListUiState()

    init(repository: ConnectionRepository) {
        self.repository = repository
        self.viewModel = Shared.ConnectionListViewModel(repository: repository)
        loadConnections()

        // Observe Kotlin StateFlow
        observeStateFlow()
    }

    private func observeStateFlow() {
        // Convert Kotlin StateFlow to SwiftUI published property
        // The Kotlin ViewModel updates its internal state; we poll for changes
        // A production implementation would use proper Kotlin Flow <-> SwiftUI Combine binding
        refreshState()
    }

    func loadConnections() {
        viewModel.loadConnections()
        // Update published state after async operation completes
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.refreshState()
        }
    }

    func deleteConnection(id: String) {
        viewModel.deleteConnection(id: id)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.refreshState()
        }
    }

    func reorderConnections(ids: [String]) {
        viewModel.reorderConnections(ids: ids)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.refreshState()
        }
    }

    private func refreshState() {
        // Get the latest state from the Kotlin ViewModel's StateFlow
        // The ConnectionListViewModel exposes _uiState as a MutableStateFlow
        // We access the current value directly via the uiState property
        let kotlinUiState = viewModel.uiState
        let connections = kotlinUiState.connections.toArray() as! [ConnectionConfig]

        uiState.isLoading = kotlinUiState.isLoading
        uiState.connections = connections
        uiState.error = kotlinUiState.error?.description
        // isEmpty is computed from connections and isLoading
    }
}

// MARK: - UI State Model
struct ConnectionListUiState {
    var isLoading: Bool = false
    var connections: [ConnectionConfig] = []
    var error: String?
    var isEmpty: Bool { connections.isEmpty && !isLoading }
}

// MARK: - Preview
#Preview {
    NavigationView {
        ConnectionListScreen(repository: FakeConnectionRepository()) { _ in }
    }
    .preferredColorScheme(.dark)
}

// MARK: - Fake Repository for Preview
class FakeConnectionRepository: ConnectionRepository {
    func getAllConnections(completion: @escaping (Result<[ConnectionConfig], Error>) -> Void) {
        let connections = [
            ConnectionConfig(
                id: "1",
                displayName: "My Server",
                host: "example.com",
                port: 22,
                username: "user",
                transportType: .ssh,
                sshKeyAlias: nil,
                sortOrder: 0,
                lastConnectedAt: KotlinInt64(value: Int64(Date().timeIntervalSince1970 * 1000)),
                createdAt: KotlinInt64(value: Int64(Date().timeIntervalSince1970 * 1000)),
                updatedAt: KotlinInt64(value: Int64(Date().timeIntervalSince1970 * 1000))
            )
        ]
        completion(.success(connections))
    }

    func getConnectionById(id: String, completion: @escaping (Result<ConnectionConfig, Error>) -> Void) {
        // Not implemented for preview
    }

    func createConnection(config: ConnectionConfig, completion: @escaping (Result<ConnectionConfig, Error>) -> Void) {
        // Not implemented for preview
    }

    func updateConnection(config: ConnectionConfig, completion: @escaping (Result<ConnectionConfig, Error>) -> Void) {
        // Not implemented for preview
    }

    func deleteConnection(id: String, completion: @escaping (Result<Void, Error>) -> Void) {
        // Not implemented for preview
    }

    func reorderConnections(ids: [String], completion: @escaping (Result<Void, Error>) -> Void) {
        // Not implemented for preview
    }
}
