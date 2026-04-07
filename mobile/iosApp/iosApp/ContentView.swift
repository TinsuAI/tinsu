import SwiftUI

// MARK: - Tab Definition
/// Navigation tabs — defined separately to avoid tight coupling with ContentView.
enum TinsuTab: Int, CaseIterable {
    case chat, docs, tasks, settings
}

// MARK: - Root Content View
struct ContentView: View {
    @State private var selectedTab: TinsuTab = .chat
    @State private var chatPath    = NavigationPath()
    @State private var docsPath    = NavigationPath()
    @State private var tasksPath   = NavigationPath()
    @State private var settingsPath = NavigationPath()

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

            // Settings
            NavigationStack(path: $settingsPath) {
                SettingsPlaceholderView()
                    .navigationTitle("Settings")
                    .navigationBarTitleDisplayMode(.large)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbarBackground(Material.bar, for: .navigationBar)
            }
            .tabItem { Label("Settings", systemImage: "gearshape") }
            .tag(TinsuTab.settings)
        }
        .tint(TinsuColors.primary)
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(Material.bar, for: .tabBar)
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

struct SettingsPlaceholderView: View {
    var body: some View {
        List {
            Text("Settings coming soon")
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
