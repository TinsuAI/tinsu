package com.tinsu.mobile.security

import com.tinsu.mobile.util.Result

expect class SecureKeyStore {
    suspend fun generateKeyPair(
        alias: String,
        keyType: KeyType = KeyType.Ed25519
    ): Result<SshKeyPair>

    suspend fun getPublicKey(alias: String): Result<String>

    suspend fun listKeys(): Result<List<SshKeyPair>>

    suspend fun deleteKey(alias: String): Result<Unit>

    suspend fun hasKey(alias: String): Result<Boolean>
}
