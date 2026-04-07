package com.tinsu.mobile.security

enum class KeyType(
    val displayName: String,
    val sshKeyTypePrefix: String
) {
    Ed25519("Ed25519 (Recommended)", "ssh-ed25519"),
    RSA2048("RSA 2048", "ssh-rsa"),
    RSA4096("RSA 4096", "ssh-rsa"),
    ECDSA_P256("ECDSA P-256", "ecdsa-sha2-nistp256"),
    ECDSA_P384("ECDSA P-384", "ecdsa-sha2-nistp384"),
    ECDSA_P521("ECDSA P-521", "ecdsa-sha2-nistp521")
}
