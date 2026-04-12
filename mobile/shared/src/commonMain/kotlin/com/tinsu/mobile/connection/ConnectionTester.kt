package com.tinsu.mobile.connection

import com.tinsu.mobile.security.SecureKeyStoreContract
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlin.math.min
import kotlin.math.pow
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout

class ConnectionTester(
    private val remoteExecutor: RemoteExecutorContract,
    private val secureKeyStore: SecureKeyStoreContract
) {
    suspend fun deployPublicKey(
        config: ConnectionConfig,
        password: String,
        publicKey: String
    ): com.tinsu.mobile.util.Result<Unit> {
        return remoteExecutor.deployPublicKey(
            host = config.host,
            port = config.port,
            username = config.username,
            password = password,
            publicKey = publicKey
        )
    }

    suspend fun testConnection(config: ConnectionConfig): ConnectionTestResult {
        // Validate required fields
        if (config.host.isBlank()) {
            return ConnectionTestResult.Failure(
                errorType = ConnectionErrorType.HOST_UNREACHABLE,
                message = "Host is required",
                troubleshootingHints = listOf("Enter a hostname or IP address")
            )
        }
        if (config.username.isBlank()) {
            return ConnectionTestResult.Failure(
                errorType = ConnectionErrorType.AUTH_FAILED,
                message = "Username is required",
                troubleshootingHints = listOf("Enter the SSH username for the remote PC")
            )
        }

        val keyAlias = config.sshKeyAlias
        if (keyAlias.isNullOrBlank()) {
            return ConnectionTestResult.Failure(
                errorType = ConnectionErrorType.KEY_NOT_FOUND,
                message = "No SSH key selected",
                troubleshootingHints = listOf("Select or generate an SSH key before testing")
            )
        }

        // Validate key exists
        val hasKey = when (val r = secureKeyStore.hasKey(keyAlias)) {
            is Result.Success -> r.data
            is Result.Failure -> false
        }
        if (!hasKey) {
            return ConnectionTestResult.Failure(
                errorType = ConnectionErrorType.KEY_NOT_FOUND,
                message = "SSH key '$keyAlias' not found",
                troubleshootingHints = listOf(
                    "The selected SSH key was not found.",
                    "Generate a new key or select a different one."
                )
            )
        }

        return try {
            withTimeout(CONNECTION_TIMEOUT_MS) {
                val connectResult = remoteExecutor.connect(
                    config.host, config.port, config.username, keyAlias
                )
                when (connectResult) {
                    is Result.Success -> {
                        // Verify command execution works
                        val execResult = remoteExecutor.exec("echo 'tinsu-test'")
                        remoteExecutor.disconnect()
                        if (execResult.exitCode == 0) {
                            ConnectionTestResult.Success(connectResult.data)
                        } else {
                            ConnectionTestResult.Failure(
                                errorType = ConnectionErrorType.UNKNOWN,
                                message = "Command execution failed (exit code ${execResult.exitCode})",
                                troubleshootingHints = listOf(
                                    "Connected but could not execute commands.",
                                    "Check the remote PC's SSH configuration."
                                )
                            )
                        }
                    }
                    is Result.Failure -> mapFailure(connectResult.error)
                }
            }
        } catch (_: kotlinx.coroutines.TimeoutCancellationException) {
            ConnectionTestResult.Failure(
                errorType = ConnectionErrorType.TIMEOUT,
                message = "Connection timed out after ${CONNECTION_TIMEOUT_MS / 1000} seconds",
                troubleshootingHints = listOf(
                    "Check your network connectivity.",
                    "The remote PC may be behind a firewall."
                )
            )
        } catch (e: Exception) {
            ConnectionTestResult.Failure(
                errorType = ConnectionErrorType.UNKNOWN,
                message = e.message ?: "Unexpected error",
                troubleshootingHints = listOf("An unexpected error occurred. Please try again.")
            )
        } finally {
            try { remoteExecutor.disconnect() } catch (_: Exception) { }
        }
    }

    suspend fun testWithRetry(
        config: ConnectionConfig,
        maxAttempts: Int = MAX_RETRY_ATTEMPTS
    ): ConnectionTestResult {
        var lastResult: ConnectionTestResult = ConnectionTestResult.Failure(
            ConnectionErrorType.UNKNOWN, "No attempts made", emptyList()
        )

        repeat(maxAttempts) { attempt ->
            lastResult = testConnection(config)

            when (lastResult) {
                is ConnectionTestResult.Success -> return lastResult
                is ConnectionTestResult.Failure -> {
                    // Don't retry non-transient errors
                    if (lastResult.errorType !in TRANSIENT_ERRORS) return lastResult

                    // Don't delay after last attempt
                    if (attempt < maxAttempts - 1) {
                        val backoffMs = min(
                            BASE_RETRY_DELAY_MS * 2.0.pow(attempt).toLong(),
                            MAX_RETRY_DELAY_MS
                        )
                        delay(backoffMs)
                    }
                }
            }
        }

        return lastResult
    }

    private fun mapFailure(error: AppError): ConnectionTestResult.Failure {
        return when (error) {
            is AppError.ConnectionFailed -> {
                val msg = error.reason
                when {
                    msg.contains("Host unreachable", ignoreCase = true) ->
                        ConnectionTestResult.Failure(
                            ConnectionErrorType.HOST_UNREACHABLE, msg,
                            listOf("Check the hostname/IP address is correct.")
                        )
                    msg.contains("Authentication failed", ignoreCase = true) ||
                        msg.contains("Permission denied", ignoreCase = true) ->
                        ConnectionTestResult.Failure(
                            ConnectionErrorType.AUTH_FAILED, msg,
                            listOf(
                                "Verify your SSH public key is in the remote PC's ~/.ssh/authorized_keys.",
                                "Check that the username is correct."
                            )
                        )
                    msg.contains("refused", ignoreCase = true) ->
                        ConnectionTestResult.Failure(
                            ConnectionErrorType.PORT_BLOCKED, msg,
                            listOf("Verify the SSH port is open on the remote PC. Default is 22.")
                        )
                    else ->
                        ConnectionTestResult.Failure(
                            ConnectionErrorType.NETWORK_ERROR, msg,
                            listOf("Check your internet connection and try again.")
                        )
                }
            }
            is AppError.Timeout ->
                ConnectionTestResult.Failure(
                    ConnectionErrorType.TIMEOUT, error.operation,
                    listOf(
                        "Check your network connectivity.",
                        "The remote PC may be behind a firewall."
                    )
                )
            is AppError.KeyNotFound ->
                ConnectionTestResult.Failure(
                    ConnectionErrorType.KEY_NOT_FOUND, error.userMessage,
                    listOf(
                        "The selected SSH key was not found.",
                        "Generate a new key or select a different one."
                    )
                )
            else ->
                ConnectionTestResult.Failure(
                    ConnectionErrorType.UNKNOWN, error.userMessage,
                    listOf("An unexpected error occurred. Please try again.")
                )
        }
    }

    companion object {
        private const val CONNECTION_TIMEOUT_MS = 5000L
        private const val BASE_RETRY_DELAY_MS = 1000L
        private const val MAX_RETRY_DELAY_MS = 30000L
        private const val MAX_RETRY_ATTEMPTS = 5

        private val TRANSIENT_ERRORS = setOf(
            ConnectionErrorType.TIMEOUT,
            ConnectionErrorType.HOST_UNREACHABLE,
            ConnectionErrorType.NETWORK_ERROR
        )
    }
}
