import SwiftUI
import Shared

// MARK: - Tab Definition
/// Navigation tabs — defined separately to avoid tight coupling with ContentView.
enum TinsuTab: Int, CaseIterable {
    case chat, docs, tasks, connections
}

// MARK: - Root Content View
struct ContentView: View {
    @State private var selectedTab: TinsuTab = .chat
    @State private var chatPath    = NavigationPath()
    @State private var docsPath    = NavigationPath()
    @State private var tasksPath   = NavigationPath()
    @State private var connectionsPath = NavigationPath()

    /// Tracks which connection the user tapped so we can push ProjectDiscoveryView.
    @State private var selectedConnection: ConnectionConfig? = nil

    private let connectionRepository: ConnectionRepository? = try? KoinHelperKt.getConnectionRepository()

    var body: some View {
        TabView(selection: $selectedTab) {
            // Chat
            NavigationStack(path: $chatPath) {
                ChatPlaceholderView()
                    .navigationTitle("Chat")
                    .navigationBarTitleDisplayMode(.large)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbarBackground(Material.bar, for: .navigationBar)
            }
            .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right.fill") }
            .tag(TinsuTab.chat)

            // Docs
            NavigationStack(path: $docsPath) {
                DocsPlaceholderView()
                    .navigationTitle("Docs")
                    .navigationBarTitleDisplayMode(.large)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbarBackground(Material.bar, for: .navigationBar)
            }
            .tabItem { Label("Docs", systemImage: "doc.text") }
            .tag(TinsuTab.docs)

            // Tasks
            NavigationStack(path: $tasksPath) {
                TasksPlaceholderView()
                    .navigationTitle("Tasks")
                    .navigationBarTitleDisplayMode(.large)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbarBackground(Material.bar, for: .navigationBar)
            }
            .tabItem { Label("Tasks", systemImage: "checklist") }
            .tag(TinsuTab.tasks)

            // Connections → Project Discovery
            NavigationStack(path: $connectionsPath) {
                connectionsRoot
            }
            .tabItem { Label("Connections", systemImage: "server.rack") }
            .tag(TinsuTab.connections)
        }
        .tint(TinsuColors.primary)
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(Material.bar, for: .tabBar)
    }

    // MARK: - Connections Root

    @ViewBuilder
    private var connectionsRoot: some View {
        if let repo = connectionRepository {
            ConnectionListScreen(
                repository: repo,
                onConnectionClick: { connection in
                    selectedConnection = connection
                }
            )
            .navigationTitle("Connections")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(Material.bar, for: .navigationBar)
            .navigationDestination(isPresented: Binding(
                get: { selectedConnection != nil },
                set: { if !$0 { selectedConnection = nil } }
            )) {
                ProjectDiscoveryView(
                    onProjectSelected: { _ in
                        // TODO: navigate to project dashboard in future story
                    }
                )
            }
        } else {
            Text("Failed to load connections")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurfaceVariant)
                .navigationTitle("Connections")
                .navigationBarTitleDisplayMode(.large)
        }
    }
}

// MARK: - Tab Placeholder Views
struct ChatPlaceholderView: View {
    var body: some View {
        List {
            Text("Chat coming soon")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurface)
                .frame(minHeight: TinsuSpacing.minTouchTarget)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(TinsuColors.background)
    }
}

struct DocsPlaceholderView: View {
    var body: some View {
        List {
            Text("Docs coming soon")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurface)
                .frame(minHeight: TinsuSpacing.minTouchTarget)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(TinsuColors.background)
    }
}

struct TasksPlaceholderView: View {
    var body: some View {
        List {
            Text("Tasks coming soon")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onSurface)
                .frame(minHeight: TinsuSpacing.minTouchTarget)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(TinsuColors.background)
    }
}

// MARK: - Preview
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .preferredColorScheme(.dark)
    }
}
