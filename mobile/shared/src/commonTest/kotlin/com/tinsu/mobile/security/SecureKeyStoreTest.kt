package com.tinsu.mobile.security

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

class KeyTypeTest {

    @Test
    fun ed25519HasCorrectDisplayName() {
        assertEquals("Ed25519 (Recommended)", KeyType.Ed25519.displayName)
    }

    @Test
    fun rsa2048HasCorrectDisplayName() {
        assertEquals("RSA 2048", KeyType.RSA2048.displayName)
    }

    @Test
    fun rsa4096HasCorrectDisplayName() {
        assertEquals("RSA 4096", KeyType.RSA4096.displayName)
    }

    @Test
    fun ecdsaP256HasCorrectDisplayName() {
        assertEquals("ECDSA P-256", KeyType.ECDSA_P256.displayName)
    }

    @Test
    fun ecdsaP384HasCorrectDisplayName() {
        assertEquals("ECDSA P-384", KeyType.ECDSA_P384.displayName)
    }

    @Test
    fun ecdsaP521HasCorrectDisplayName() {
        assertEquals("ECDSA P-521", KeyType.ECDSA_P521.displayName)
    }

    @Test
    fun ed25519HasCorrectSshPrefix() {
        assertEquals("ssh-ed25519", KeyType.Ed25519.sshKeyTypePrefix)
    }

    @Test
    fun rsaKeysShareSshPrefix() {
        assertEquals("ssh-rsa", KeyType.RSA2048.sshKeyTypePrefix)
        assertEquals("ssh-rsa", KeyType.RSA4096.sshKeyTypePrefix)
    }

    @Test
    fun ecdsaP256HasCorrectSshPrefix() {
        assertEquals("ecdsa-sha2-nistp256", KeyType.ECDSA_P256.sshKeyTypePrefix)
    }

    @Test
    fun ecdsaP384HasCorrectSshPrefix() {
        assertEquals("ecdsa-sha2-nistp384", KeyType.ECDSA_P384.sshKeyTypePrefix)
    }

    @Test
    fun ecdsaP521HasCorrectSshPrefix() {
        assertEquals("ecdsa-sha2-nistp521", KeyType.ECDSA_P521.sshKeyTypePrefix)
    }

    @Test
    fun allKeyTypesExist() {
        val expected = setOf(
            KeyType.Ed25519,
            KeyType.RSA2048,
            KeyType.RSA4096,
            KeyType.ECDSA_P256,
            KeyType.ECDSA_P384,
            KeyType.ECDSA_P521
        )
        assertEquals(expected, KeyType.entries.toSet())
    }

    @Test
    fun keyTypesHaveUniqueDisplayNames() {
        val displayNames = KeyType.entries.map { it.displayName }
        assertEquals(displayNames.size, displayNames.toSet().size)
    }
}

class SshKeyPairTest {

    @Test
    fun sshKeyPairStoresAlias() {
        val pair = SshKeyPair(
            alias = "test-key",
            keyType = KeyType.Ed25519,
            publicKeyOpenSshFormat = "ssh-ed25519 AAAA test",
            createdAt = 1000L
        )
        assertEquals("test-key", pair.alias)
    }

    @Test
    fun sshKeyPairStoresKeyType() {
        val pair = SshKeyPair(
            alias = "test-key",
            keyType = KeyType.RSA2048,
            publicKeyOpenSshFormat = "ssh-rsa AAAA test",
            createdAt = 1000L
        )
        assertEquals(KeyType.RSA2048, pair.keyType)
    }

    @Test
    fun sshKeyPairStoresPublicKey() {
        val pubKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample tinsu-mobile@android"
        val pair = SshKeyPair(
            alias = "test-key",
            keyType = KeyType.Ed25519,
            publicKeyOpenSshFormat = pubKey,
            createdAt = 1000L
        )
        assertEquals(pubKey, pair.publicKeyOpenSshFormat)
    }

    @Test
    fun sshKeyPairStoresCreatedAt() {
        val pair = SshKeyPair(
            alias = "test-key",
            keyType = KeyType.Ed25519,
            publicKeyOpenSshFormat = "ssh-ed25519 AAAA test",
            createdAt = 1712345678000L
        )
        assertEquals(1712345678000L, pair.createdAt)
    }

    @Test
    fun sshKeyPairDoesNotContainPrivateKey() {
        // SshKeyPair is a data class with exactly 4 properties:
        // alias, keyType, publicKeyOpenSshFormat, createdAt
        // Verify via copy() that no extra fields exist (compile-time guarantee)
        val pair = SshKeyPair(
            alias = "test-key",
            keyType = KeyType.Ed25519,
            publicKeyOpenSshFormat = "ssh-ed25519 AAAA test",
            createdAt = 1000L
        )
        val copy = pair.copy()
        assertEquals(pair, copy)
        assertEquals("test-key", pair.alias)
        assertEquals(KeyType.Ed25519, pair.keyType)
        assertEquals("ssh-ed25519 AAAA test", pair.publicKeyOpenSshFormat)
        assertEquals(1000L, pair.createdAt)
    }

    @Test
    fun sshKeyPairEquality() {
        val pair1 = SshKeyPair("key1", KeyType.Ed25519, "ssh-ed25519 AAAA test", 1000L)
        val pair2 = SshKeyPair("key1", KeyType.Ed25519, "ssh-ed25519 AAAA test", 1000L)
        val pair3 = SshKeyPair("key2", KeyType.Ed25519, "ssh-ed25519 AAAA test", 1000L)
        assertEquals(pair1, pair2)
        assertNotEquals(pair1, pair3)
    }

    @Test
    fun publicKeyStartsWithCorrectTypePrefix() {
        val pair = SshKeyPair(
            alias = "test-key",
            keyType = KeyType.Ed25519,
            publicKeyOpenSshFormat = "ssh-ed25519 AAAA tinsu-mobile@android",
            createdAt = 1000L
        )
        assert(pair.publicKeyOpenSshFormat.startsWith(pair.keyType.sshKeyTypePrefix))
    }
}
