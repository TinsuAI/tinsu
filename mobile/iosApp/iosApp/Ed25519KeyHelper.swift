import Foundation
import CryptoKit
import Security

/// Swift bridge for Ed25519 key generation using CryptoKit.
/// Called from Kotlin/Native IosSecureKeyStore via the Ed25519KeyProvider interface.
@objc public class Ed25519KeyHelper: NSObject {

    /// Generates an Ed25519 key pair, stores the private key in Keychain,
    /// and returns the raw public key bytes as a base64 string.
    @objc public func generateAndStoreKey(alias: String) -> String? {
        let privateKey = Curve25519.Signing.PrivateKey()
        let publicKey = privateKey.publicKey

        // Store private key in Keychain
        let privateKeyData = privateKey.rawRepresentation
        let tag = "com.tinsu.mobile.ed25519.\(alias)".data(using: .utf8)!

        // Delete existing key with same alias first
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.tinsu.mobile.ed25519",
            kSecAttrAccount as String: alias
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Store the private key
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.tinsu.mobile.ed25519",
            kSecAttrAccount as String: alias,
            kSecAttrApplicationTag as String: tag,
            kSecValueData as String: privateKeyData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess || status == errSecDuplicateItem else {
            return nil
        }

        // Return raw public key bytes as base64
        return publicKey.rawRepresentation.base64EncodedString()
    }

    /// Deletes an Ed25519 key pair from Keychain.
    @objc public func deleteKey(alias: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.tinsu.mobile.ed25519",
            kSecAttrAccount as String: alias
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}
