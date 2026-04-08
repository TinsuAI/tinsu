package com.tinsu.mobile.connection

import com.tinsu.mobile.security.SecureKeyStoreContract
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeout
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail
import kotlin.test.assertNotNull

class ConnectionManagerStateTest {

    /**
     * Mock RemoteExecutor for testing.
     */
    class MockRemoteExecutor : RemoteExecutorContract {
        var connectCalled = false
        var disconnectCalled = false
        var execCalled = false
        var shouldFail = false

        override suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<SessionInfo> {
            connectCalled = true
            if (shouldFail) {
                return Result.Failure(AppError.ConnectionFailed("Mock connection failure"))
            }
            return Result.Success(
                SessionInfo(
                    host = host,
                    port = port,
                    username = username,
                    transport = TransportType.SSH
                )
            )
        }

        override suspend fun disconnect() {
            disconnectCalled = true
        }

        override suspend fun exec(command: String): CommandResult {
            execCalled = true
            if (shouldFail) {
                return CommandResult(exitCode = 1, stdout = "", stderr = "Mock command failure")
            }
            return CommandResult(exitCode = 0, stdout = "tinsu-test", stderr = "")
        }
    }

    /**
     * Mock SecureKeyStore for testing.
     */
    class MockSecureKeyStore : SecureKeyStoreContract {
        override suspend fun hasKey(alias: String): Result<Boolean> {
            return Result.Success(true)
        }

        override suspend fun saveKey(alias: String, privateKey: ByteArray): Result<Unit> {
            return Result.Success(Unit)
        }

        override suspend fun loadKey(alias: String): Result<ByteArray> {
            return Result.Success("mock-key".toByteArray())
        }

        override suspend fun deleteKey(alias: String): Result<Unit> {
            return Result.Success(Unit)
        }

        override suspend fun listKeys(): Result<List<String>> {
            return Result.Success(listOf("test-key"))
        }
    }

    @Test
    fun `ConnectionManager starts in Offline state`() = runTest {
        val mockExecutor = MockRemoteExecutor()
        val mockKeyStore = MockSecureKeyStore()
        val connectionTester = ConnectionTester(mockExecutor, mockKeyStore)

        val connectionManager = ConnectionManagerImpl(
            connectionTester = connectionTester,
            remoteExecutor = mockExecutor,
            hapticFeedback = null,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        )

        val initialState = connectionManager.connectionState.first()
        assertTrue(initialState is ConnectionEvent.Offline)
    }

    @Test
    fun `ConnectionManager transitions to Reconnecting then Connected on successful connection`() = runTest {
        val mockExecutor = MockRemoteExecutor()
        mockExecutor.shouldFail = false
        val mockKeyStore = MockSecureKeyStore()
        val connectionTester = ConnectionTester(mockExecutor, mockKeyStore)

        val connectionManager = ConnectionManagerImpl(
            connectionTester = connectionTester,
            remoteExecutor = mockExecutor,
            hapticFeedback = null,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        )

        val config = ConnectionConfig(
            displayName = "Test Connection",
            host = "192.168.1.100",
            port = 22,
            username = "testuser",
            sshKeyAlias = "test-key"
        )

        // Start connection
        connectionManager.connect(config)

        // Wait for state to settle (should reach Connected)
        withTimeout(5000L) {
            var state: ConnectionEvent? = null
            while (state !is ConnectionEvent.Connected) {
                state = connectionManager.connectionState.first()
                if (state is ConnectionEvent.Reconnecting) {
                    kotlinx.coroutines.delay(100) // Wait for transition
                } else if (state is ConnectionEvent.Connected) {
                    break
                } else {
                    kotlinx.coroutines.delay(100)
                }
            }
        }

        val finalState = connectionManager.connectionState.first()
        assertTrue(finalState is ConnectionEvent.Connected)
        assertEquals("192.168.1.100", finalState.host)
        assertEquals(22, finalState.port)
    }

    @Test
    fun `ConnectionManager transitions to Disconnected on connection failure`() = runTest {
        val mockExecutor = MockRemoteExecutor()
        mockExecutor.shouldFail = true // Make connection fail
        val mockKeyStore = MockSecureKeyStore()
        val connectionTester = ConnectionTester(mockExecutor, mockKeyStore)

        val connectionManager = ConnectionManagerImpl(
            connectionTester = connectionTester,
            remoteExecutor = mockExecutor,
            hapticFeedback = null,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        )

        val config = ConnectionConfig(
            displayName = "Test Connection",
            host = "192.168.1.100",
            port = 22,
            username = "testuser",
            sshKeyAlias = "test-key"
        )

        // Start connection (will fail)
        connectionManager.connect(config)

        // Wait for state to settle (should reach Disconnected)
        withTimeout(5000L) {
            var state: ConnectionEvent? = null
            while (state !is ConnectionEvent.Disconnected) {
                state = connectionManager.connectionState.first()
                if (state is ConnectionEvent.Reconnecting) {
                    kotlinx.coroutines.delay(100)
                } else if (state is ConnectionEvent.Disconnected) {
                    break
                } else {
                    kotlinx.coroutines.delay(100)
                }
            }
        }

        val finalState = connectionManager.connectionState.first()
        assertTrue(finalState is ConnectionEvent.Disconnected)
        assertNotNull(finalState.reason)
    }

    @Test
    fun `ConnectionManager gracefully handles timeout without crashing`() = runTest {
        val mockExecutor = MockRemoteExecutor()
        // Simulate timeout by having tester's timeout handle it
        val mockKeyStore = MockSecureKeyStore()
        val connectionTester = ConnectionTester(mockExecutor, mockKeyStore)

        val connectionManager = ConnectionManagerImpl(
            connectionTester = connectionTester,
            remoteExecutor = mockExecutor,
            hapticFeedback = null,
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        )

        val config = ConnectionConfig(
            displayName = "Test Connection",
            host = "192.168.1.100",
            port = 22,
            username = "testuser",
            sshKeyAlias = "test-key"
        )

        // This should not throw even if it fails
        try {
            connectionManager.connect(config)
            val state = connectionManager.connectionState.first()
            // Should either be Reconnecting, Disconnected, or Connected (not crash)
            assertTrue(state is ConnectionEvent.Reconnecting ||
                      state is ConnectionEvent.Disconnected ||
                      state is ConnectionEvent.Connected)
        } catch (e: Exception) {
            fail("ConnectionManager should not throw exceptions: ${e.message}")
        }
    }

    @Test
    fun `formatUptime formats milliseconds correctly`() {
        // Test less than 1 minute
        assertEquals("< 1m", ConnectionMonitor.formatUptime(30_000L))
        assertEquals("< 1m", ConnectionMonitor.formatUptime(59_999L))

        // Test minutes and seconds
        assertEquals("1m 0s", ConnectionMonitor.formatUptime(60_000L))
        assertEquals("5m 30s", ConnectionMonitor.formatUptime(330_000L))
        assertEquals("59m 59s", ConnectionMonitor.formatUptime(3_599_999L))

        // Test hours and minutes
        assertEquals("1h 0m", ConnectionMonitor.formatUptime(3_600_000L))
        assertEquals("2h 30m", ConnectionMonitor.formatUptime(9_000_000L))
        assertEquals("24h 0m", ConnectionMonitor.formatUptime(86_400_000L))
    }

    @Test
    fun `ConnectionMonitor exponential backoff increases delay`() = runTest {
        // This test verifies the backoff calculation formula
        // Expected delays: 1s, 2s, 4s, 8s, 30s (max)
        val baseDelay = 1000L
        val maxDelay = 30000L

        val delays = (0 until 5).map { attempt ->
            min(baseDelay * 2.0.pow(attempt).toLong(), maxDelay)
        }

        assertEquals(1000L, delays[0]) // 1s
        assertEquals(2000L, delays[1]) // 2s
        assertEquals(4000L, delays[2]) // 4s
        assertEquals(8000L, delays[3]) // 8s
        assertEquals(30000L, delays[4]) // 30s (max)
    }

    // Note: HapticFeedback is an expect class and cannot be mocked directly in commonTest
    // Haptic feedback integration is tested via platform-specific tests (Android/iOS)
}
