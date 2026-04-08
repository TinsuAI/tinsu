package com.tinsu.mobile.security

import com.tinsu.mobile.util.Result

/**
 * Interface for key storage operations used by ConnectionTester.
 * The expect class SecureKeyStore implements this interface.
 */
interface SecureKeyStoreContract {
    suspend fun hasKey(alias: String): Result<Boolean>
    suspend fun getKeyType(alias: String): Result<KeyType>
    suspend fun getPrivateKeyData(alias: String): Result<ByteArray>
}

expect class SecureKeyStore : SecureKeyStoreContract {
    suspend fun generateKeyPair(
        alias: String,
        keyType: KeyType = KeyType.Ed25519
    ): Result<SshKeyPair>

    suspend fun getPublicKey(alias: String): Result<String>

    suspend fun listKeys(): Result<List<SshKeyPair>>

    suspend fun deleteKey(alias: String): Result<Unit>

    override suspend fun hasKey(alias: String): Result<Boolean>

    override suspend fun getKeyType(alias: String): Result<KeyType>

    override suspend fun getPrivateKeyData(alias: String): Result<ByteArray>
}
