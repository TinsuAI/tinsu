import SwiftUI
import Shared

@main
struct iOSApp: App {
    init() {
        KoinHelperKt.initKoin()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
