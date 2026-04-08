package com.tinsu.mobile.connection

import com.tinsu.mobile.util.Result

/**
 * Interface for remote command execution, used by ConnectionTester.
 * The expect class RemoteExecutor implements this interface.
 */
interface RemoteExecutorContract {
    suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<SessionInfo>
    suspend fun exec(command: String): CommandResult
    suspend fun disconnect()
    fun isConnected(): Boolean
}

expect class RemoteExecutor(secureKeyStore: com.tinsu.mobile.security.SecureKeyStore) : RemoteExecutorContract
