import Foundation
import Shared

/// Bridges the Swift Ed25519KeyHelper to the Kotlin Ed25519KeyProvider interface.
class Ed25519KeyProviderBridge: Ed25519KeyProvider {
    private let helper = Ed25519KeyHelper()

    func generateAndStoreKey(alias: String) -> String? {
        return helper.generateAndStoreKey(alias: alias)
    }

    func deleteKey(alias: String) -> KotlinBoolean {
        return KotlinBoolean(bool: helper.deleteKey(alias: alias))
    }
}
