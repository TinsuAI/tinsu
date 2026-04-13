import Foundation
import Shared

/// Bridges the Swift Ed25519KeyHelper to the Kotlin Ed25519KeyProvider interface.
class Ed25519KeyProviderBridge: Ed25519KeyProvider {
    private let helper = Ed25519KeyHelper()

    func generateAndStoreKey(alias: String) -> String? {
        return helper.generateAndStoreKey(alias: alias)
    }

    func getPrivateKeyData(alias: String) -> KotlinByteArray? {
        guard let data = helper.getPrivateKeyData(alias: alias) else { return nil }
        let result = KotlinByteArray(size: Int32(data.count))
        for (i, byte) in data.enumerated() {
            result.set(index: Int32(i), value: Int8(bitPattern: byte))
        }
        return result
    }

    func deleteKey(alias: String) -> Bool {
        return helper.deleteKey(alias: alias)
    }
}
