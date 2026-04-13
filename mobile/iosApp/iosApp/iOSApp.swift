import SwiftUI
import Shared

@main
struct iOSApp: App {
    @StateObject private var setupState = AppRootState()

    init() {
        let ed25519Provider = Ed25519KeyProviderBridge()
        let sshProvider = SshProvider()
        KoinHelperKt.doInitKoin(ed25519Provider: ed25519Provider, sshProvider: sshProvider)
    }

    var body: some Scene {
        WindowGroup {
            if setupState.showSetup {
                SetupFlowView(onComplete: {
                    setupState.showSetup = false
                })
                .preferredColorScheme(.dark)
            } else {
                ContentView()
                    .preferredColorScheme(.dark)
            }////
        }
    }
}

// MARK: - App Root State
class AppRootState: ObservableObject {
    @Published var showSetup: Bool = true

    init() {
        // Check async whether setup is needed
        Task { @MainActor in
            do {
                let detector = try KoinHelperKt.getSetupDetector()
                let shouldShow = try await detector.shouldShowSetup()
                self.showSetup = shouldShow as? Bool ?? shouldShow.boolValue
            } catch {
                // Default to showing setup on error
            }
        }
    }
}
