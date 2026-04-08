package com.tinsu.mobile.connection

import com.tinsu.mobile.security.SecureKeyStoreContract
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

/**
 * Tests for ConnectionTester using fakes for platform dependencies.
 * Uses SecureKeyStoreContract and RemoteExecutorContract interfaces
 * to avoid requiring platform-specific implementations.
 */
class ConnectionTesterTest {

    // --- Validation tests (early-return paths) ---

    @Test
    fun testConnection_blankHost_returnsHostUnreachableError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.HOST_UNREACHABLE, result.errorType)
        assertTrue(result.message.contains("Host is required"))
    }

    @Test
    fun testConnection_blankUsername_returnsAuthFailedError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.AUTH_FAILED, result.errorType)
        assertTrue(result.message.contains("Username is required"))
    }

    @Test
    fun testConnection_nullKeyAlias_returnsKeyNotFoundError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = null
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.KEY_NOT_FOUND, result.errorType)
        assertTrue(result.message.contains("No SSH key selected"))
    }

    @Test
    fun testConnection_blankKeyAlias_returnsKeyNotFoundError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "   "
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.KEY_NOT_FOUND, result.errorType)
    }

    @Test
    fun testConnection_keyNotFoundInStore_returnsKeyNotFoundError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(),
            secureKeyStore = StubSecureKeyStore(hasKey = false)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "nonexistent-key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.KEY_NOT_FOUND, result.errorType)
        assertTrue(result.message.contains("nonexistent-key"))
        assertTrue(result.troubleshootingHints.isNotEmpty())
    }

    @Test
    fun testConnection_hasKeyReturnsFailure_treatsAsNotFound() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(),
            secureKeyStore = StubSecureKeyStore(
                hasKeyResult = Result.Failure(AppError.KeyNotFound("key"))
            )
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.KEY_NOT_FOUND, result.errorType)
    }

    // --- Successful connection tests ---

    @Test
    fun testConnection_successfulConnect_returnsSuccess() = runTest {
        val sessionInfo = SessionInfo("example.com", 22, "OpenSSH_8.9", "user")
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Success(sessionInfo),
                execResult = CommandResult(0, "tinsu-test\n", "")
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Success
        assertEquals("example.com", result.sessionInfo.host)
        assertEquals(22, result.sessionInfo.port)
        assertEquals("OpenSSH_8.9", result.sessionInfo.serverVersion)
        assertEquals("user", result.sessionInfo.authenticatedAs)
    }

    // --- Connection failure mapping tests ---

    @Test
    fun testConnection_authFailed_mapsToAuthFailedError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Failure(AppError.ConnectionFailed("Authentication failed for user"))
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.AUTH_FAILED, result.errorType)
        assertTrue(result.troubleshootingHints.any { it.contains("authorized_keys") })
    }

    @Test
    fun testConnection_hostUnreachable_mapsToHostUnreachableError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Failure(AppError.ConnectionFailed("Host unreachable: no route to host"))
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "bad-host.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.HOST_UNREACHABLE, result.errorType)
    }

    @Test
    fun testConnection_connectionRefused_mapsToPortBlockedError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Failure(AppError.ConnectionFailed("Connection refused on port 22"))
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.PORT_BLOCKED, result.errorType)
    }

    @Test
    fun testConnection_timeout_mapsToTimeoutError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Failure(AppError.Timeout("Connection timed out"))
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "slow-host.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.TIMEOUT, result.errorType)
    }

    @Test
    fun testConnection_genericError_mapsToNetworkError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Failure(AppError.ConnectionFailed("Something went wrong"))
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.NETWORK_ERROR, result.errorType)
    }

    @Test
    fun testConnection_keyNotFoundError_mapsToKeyNotFoundError() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Failure(AppError.KeyNotFound("key"))
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.KEY_NOT_FOUND, result.errorType)
    }

    @Test
    fun testConnection_execFails_returnsUnknownError() = runTest {
        val sessionInfo = SessionInfo("example.com", 22, "OpenSSH", "user")
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Success(sessionInfo),
                execResult = CommandResult(1, "", "error")
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.UNKNOWN, result.errorType)
        assertTrue(result.message.contains("exit code 1"))
    }

    // --- Disconnect verification ---

    @Test
    fun testConnection_disconnectCalledOnSuccess() = runTest {
        var disconnectCalled = false
        val sessionInfo = SessionInfo("example.com", 22, "OpenSSH", "user")
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Success(sessionInfo),
                execResult = CommandResult(0, "tinsu-test\n", ""),
                onDisconnect = { disconnectCalled = true }
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        tester.testConnection(config)
        assertTrue(disconnectCalled, "disconnect() should be called after test")
    }

    @Test
    fun testConnection_disconnectCalledOnFailure() = runTest {
        var disconnectCalled = false
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Failure(AppError.ConnectionFailed("Authentication failed")),
                onDisconnect = { disconnectCalled = true }
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        tester.testConnection(config)
        assertTrue(disconnectCalled, "disconnect() should be called in finally block")
    }

    // --- Retry behavior tests ---

    @Test
    fun testWithRetry_returnsSuccessImmediatelyOnFirstSuccess() = runTest {
        val sessionInfo = SessionInfo("host", 22, "OpenSSH_8.9", "user")
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Success(sessionInfo),
                execResult = CommandResult(0, "tinsu-test\n", "")
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testWithRetry(config, maxAttempts = 5)
        assertTrue(result is ConnectionTestResult.Success)
    }

    @Test
    fun testWithRetry_doesNotRetryAuthFailed() = runTest {
        var connectAttempts = 0
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResultFn = {
                    connectAttempts++
                    Result.Failure(AppError.ConnectionFailed("Authentication failed for user"))
                }
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testWithRetry(config, maxAttempts = 5) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.AUTH_FAILED, result.errorType)
        assertEquals(1, connectAttempts, "AUTH_FAILED should not be retried")
    }

    @Test
    fun testWithRetry_doesNotRetryKeyNotFound() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(),
            secureKeyStore = StubSecureKeyStore(hasKey = false)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testWithRetry(config, maxAttempts = 5) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.KEY_NOT_FOUND, result.errorType)
    }

    @Test
    fun testWithRetry_doesNotRetryPortBlocked() = runTest {
        var connectAttempts = 0
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResultFn = {
                    connectAttempts++
                    Result.Failure(AppError.ConnectionFailed("Connection refused"))
                }
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testWithRetry(config, maxAttempts = 5) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.PORT_BLOCKED, result.errorType)
        assertEquals(1, connectAttempts, "PORT_BLOCKED should not be retried")
    }

    @Test
    fun testWithRetry_retriesTransientTimeoutErrors() = runTest {
        var attempts = 0
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResultFn = {
                    attempts++
                    if (attempts < 3) {
                        Result.Failure(AppError.Timeout("Connection timed out"))
                    } else {
                        Result.Success(SessionInfo("host", 22, "OpenSSH", "user"))
                    }
                },
                execResult = CommandResult(0, "tinsu-test\n", "")
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testWithRetry(config, maxAttempts = 5)
        assertTrue(result is ConnectionTestResult.Success, "Should succeed on 3rd attempt")
        assertEquals(3, attempts)
    }

    @Test
    fun testWithRetry_exhaustsAllAttempts_returnsLastFailure() = runTest {
        var attempts = 0
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResultFn = {
                    attempts++
                    Result.Failure(AppError.Timeout("Connection timed out"))
                }
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testWithRetry(config, maxAttempts = 5) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.TIMEOUT, result.errorType)
        assertEquals(5, attempts, "Should attempt all 5 times")
    }

    // --- Sealed class and data model tests ---

    @Test
    fun connectionTestResult_success_holdsSessionInfo() {
        val info = SessionInfo("example.com", 22, "OpenSSH_8.9", "user")
        val result = ConnectionTestResult.Success(info)
        assertEquals("example.com", result.sessionInfo.host)
        assertEquals(22, result.sessionInfo.port)
    }

    @Test
    fun connectionTestResult_failure_holdsErrorDetails() {
        val result = ConnectionTestResult.Failure(
            errorType = ConnectionErrorType.AUTH_FAILED,
            message = "Permission denied",
            troubleshootingHints = listOf("Check authorized_keys", "Verify username")
        )
        assertEquals(ConnectionErrorType.AUTH_FAILED, result.errorType)
        assertEquals(2, result.troubleshootingHints.size)
    }

    @Test
    fun allConnectionErrorTypes_areCovered() {
        val allTypes = ConnectionErrorType.entries
        assertEquals(7, allTypes.size)
        assertTrue(allTypes.contains(ConnectionErrorType.HOST_UNREACHABLE))
        assertTrue(allTypes.contains(ConnectionErrorType.AUTH_FAILED))
        assertTrue(allTypes.contains(ConnectionErrorType.TIMEOUT))
        assertTrue(allTypes.contains(ConnectionErrorType.PORT_BLOCKED))
        assertTrue(allTypes.contains(ConnectionErrorType.KEY_NOT_FOUND))
        assertTrue(allTypes.contains(ConnectionErrorType.NETWORK_ERROR))
        assertTrue(allTypes.contains(ConnectionErrorType.UNKNOWN))
    }

    @Test
    fun sessionInfo_equality() {
        val a = SessionInfo("host", 22, "OpenSSH_8.9", "user")
        val b = SessionInfo("host", 22, "OpenSSH_8.9", "user")
        assertEquals(a, b)
    }

    @Test
    fun connectionTestState_allVariantsExist() {
        val idle = ConnectionTestState.Idle
        val testing = ConnectionTestState.Testing
        val success = ConnectionTestState.Success(SessionInfo("h", 22, "v", "u"))
        val failure = ConnectionTestState.Failure(ConnectionErrorType.TIMEOUT, "msg", listOf("hint"))

        assertTrue(idle is ConnectionTestState.Idle)
        assertTrue(testing is ConnectionTestState.Testing)
        assertEquals("h", success.sessionInfo.host)
        assertEquals(ConnectionErrorType.TIMEOUT, failure.errorType)
    }

    @Test
    fun commandResult_holdsFields() {
        val result = CommandResult(0, "hello\n", "")
        assertEquals(0, result.exitCode)
        assertEquals("hello\n", result.stdout)
        assertEquals("", result.stderr)
    }

    // --- Permission denied mapping test ---

    @Test
    fun testConnection_permissionDenied_mapsToAuthFailed() = runTest {
        val tester = ConnectionTester(
            remoteExecutor = StubRemoteExecutor(
                connectResult = Result.Failure(AppError.ConnectionFailed("Permission denied (publickey)"))
            ),
            secureKeyStore = StubSecureKeyStore(hasKey = true)
        )
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "key"
        )

        val result = tester.testConnection(config) as ConnectionTestResult.Failure
        assertEquals(ConnectionErrorType.AUTH_FAILED, result.errorType)
    }
}

// --- Fakes ---

private class StubSecureKeyStore(
    private val hasKey: Boolean = true,
    private val hasKeyResult: Result<Boolean>? = null
) : SecureKeyStoreContract {
    override suspend fun hasKey(alias: String): Result<Boolean> =
        hasKeyResult ?: Result.Success(hasKey)

    override suspend fun getKeyType(alias: String): Result<com.tinsu.mobile.security.KeyType> =
        Result.Success(com.tinsu.mobile.security.KeyType.Ed25519)

    override suspend fun getPrivateKeyData(alias: String): Result<ByteArray> =
        Result.Success(ByteArray(0))
}

private class StubRemoteExecutor(
    private val connectResult: Result<SessionInfo>? = null,
    private val connectResultFn: (suspend () -> Result<SessionInfo>)? = null,
    private val execResult: CommandResult = CommandResult(0, "tinsu-test\n", ""),
    private val onDisconnect: (() -> Unit)? = null
) : RemoteExecutorContract {
    override suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<SessionInfo> =
        connectResultFn?.invoke() ?: connectResult!!

    override suspend fun exec(command: String): CommandResult = execResult
    override suspend fun disconnect() { onDisconnect?.invoke() }
    override fun isConnected(): Boolean = false
}
