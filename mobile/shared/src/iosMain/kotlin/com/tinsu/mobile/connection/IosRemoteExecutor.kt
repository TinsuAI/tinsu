package com.tinsu.mobile.connection

import com.tinsu.mobile.security.SecureKeyStore
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Interface for the Swift ssh bridge.
 * Implemented by SshExecutor.swift in the iosApp target.
 * Uses NMSSH, Shout, or SwiftNIO SSH under the hood.
 */
interface SshSessionProvider {
    fun connect(host: String, port: Int, username: String, privateKeyData: ByteArray, keyType: String): SshBridgeResult
    fun connectWithPassword(host: String, port: Int, username: String, password: String): SshBridgeResult
    fun exec(command: String): SshBridgeExecResult
    fun disconnect()
    fun isConnected(): Boolean
}

data class SshBridgeResult(
    val success: Boolean,
    val serverVersion: String = "",
    val errorMessage: String = ""
)

data class SshBridgeExecResult(
    val exitCode: Int,
    val stdout: String,
    val stderr: String
)

/**
 * Factory to create the iOS RemoteExecutor with a platform SSH provider.
 * Called from Koin DI setup in KoinHelper.kt.
 */
fun createRemoteExecutor(secureKeyStore: SecureKeyStore, sshProvider: SshSessionProvider?): RemoteExecutor {
    return RemoteExecutor(secureKeyStore).also {
        it.setSshProvider(sshProvider)
    }
}

actual class RemoteExecutor actual constructor(
    private val secureKeyStore: SecureKeyStore
) : RemoteExecutorContract {
    private var sshProvider: SshSessionProvider? = null

    fun setSshProvider(provider: SshSessionProvider?) {
        this.sshProvider = provider
    }

    override suspend fun deployPublicKey(
        host: String,
        port: Int,
        username: String,
        password: String,
        publicKey: String
    ): Result<Unit> = withContext(Dispatchers.Default) {
        val provider = sshProvider ?: return@withContext Result.Failure(
            AppError.ConnectionFailed("SSH provider not configured")
        )

        val connectResult = provider.connectWithPassword(host, port, username, password)
        if (!connectResult.success) {
            return@withContext Result.Failure(AppError.ConnectionFailed(connectResult.errorMessage))
        }

        try {
            // Append key only if not already present, then fix permissions.
            // Use $HOME instead of ~ for broader shell compatibility.
            val escapedKey = publicKey.trim().replace("'", "'\\''")
            val command = "mkdir -p \"\$HOME/.ssh\" && chmod 700 \"\$HOME/.ssh\" && " +
                "grep -qxF '$escapedKey' \"\$HOME/.ssh/authorized_keys\" 2>/dev/null || " +
                "echo '$escapedKey' >> \"\$HOME/.ssh/authorized_keys\" && " +
                "chmod 600 \"\$HOME/.ssh/authorized_keys\""

            val deployResult = provider.exec(command)
            if (deployResult.exitCode != 0) {
                provider.disconnect()
                val msg = deployResult.stderr.ifBlank { "Failed to add key (exit ${deployResult.exitCode})" }
                return@withContext Result.Failure(AppError.ConnectionFailed(msg))
            }

            // Verify the key is actually present — guards against silent failures
            // where the deploy command exits 0 but nothing was written.
            val verifyResult = provider.exec("cat \"\$HOME/.ssh/authorized_keys\" 2>/dev/null")
            provider.disconnect()

            val keyWritten = verifyResult.stdout.lines().any { it.trim() == publicKey.trim() }
            if (!keyWritten) {
                return@withContext Result.Failure(
                    AppError.ConnectionFailed("Key was not found in authorized_keys after deployment")
                )
            }

            Result.Success(Unit)
        } catch (e: Exception) {
            try { provider.disconnect() } catch (_: Exception) {}
            Result.Failure(AppError.ConnectionFailed(e.message ?: "Unknown error"))
        }
    }

    override suspend fun connect(
        host: String,
        port: Int,
        username: String,
        keyAlias: String
    ): Result<SessionInfo> = withContext(Dispatchers.Default) {
        try {
            val keyTypeResult = secureKeyStore.getKeyType(keyAlias)
            val keyType = when (keyTypeResult) {
                is Result.Success -> keyTypeResult.data
                is Result.Failure -> return@withContext Result.Failure(AppError.KeyNotFound(keyAlias))
            }

            val privateKeyResult = secureKeyStore.getPrivateKeyData(keyAlias)
            val privateKeyBytes = when (privateKeyResult) {
                is Result.Success -> privateKeyResult.data
                is Result.Failure -> return@withContext Result.Failure(AppError.KeyNotFound(keyAlias))
            }

            val provider = sshProvider
            if (provider == null) {
                return@withContext Result.Failure(
                    AppError.ConnectionFailed("SSH session provider not configured. Implement SshSessionProvider in Swift.")
                )
            }

            val result = provider.connect(
                host, port, username, privateKeyBytes, keyType.name
            )

            if (result.success) {
                Result.Success(
                    SessionInfo(
                        host = host,
                        port = port,
                        serverVersion = result.serverVersion,
                        authenticatedAs = username
                    )
                )
            } else {
                val errorMsg = result.errorMessage
                val appError = when {
                    errorMsg.contains("Permission denied", ignoreCase = true) ||
                        errorMsg.contains("authentication", ignoreCase = true) ->
                        AppError.ConnectionFailed("Authentication failed: $errorMsg")
                    errorMsg.contains("timed out", ignoreCase = true) ||
                        errorMsg.contains("timeout", ignoreCase = true) ->
                        AppError.Timeout("Connection timed out")
                    errorMsg.contains("refused", ignoreCase = true) ->
                        AppError.ConnectionFailed("Connection refused: $errorMsg")
                    errorMsg.contains("unreachable", ignoreCase = true) ||
                        errorMsg.contains("resolve", ignoreCase = true) ->
                        AppError.ConnectionFailed("Host unreachable: $errorMsg")
                    else ->
                        AppError.ConnectionFailed(errorMsg)
                }
                Result.Failure(appError)
            }
        } catch (e: Exception) {
            disconnectInternal()
            Result.Failure(AppError.ConnectionFailed(e.message ?: "Unknown connection error"))
        }
    }

    override suspend fun exec(command: String): CommandResult =
        withContext(Dispatchers.Default) {
            val provider = sshProvider
                ?: throw IllegalStateException("Not connected")

            val result = provider.exec(command)
            CommandResult(
                exitCode = result.exitCode,
                stdout = result.stdout,
                stderr = result.stderr
            )
        }

    override suspend fun disconnect() {
        withContext(Dispatchers.Default) {
            disconnectInternal()
        }
    }

    override fun isConnected(): Boolean = sshProvider?.isConnected() == true

    private fun disconnectInternal() {
        try {
            sshProvider?.disconnect()
        } catch (_: Exception) { }
    }
}
