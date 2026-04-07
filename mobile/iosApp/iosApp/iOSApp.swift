import SwiftUI
import Shared

@main
struct iOSApp: App {
    init() {
        let ed25519Provider = Ed25519KeyProviderBridge()
        KoinHelperKt.initKoin(ed25519Provider: ed25519Provider)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
