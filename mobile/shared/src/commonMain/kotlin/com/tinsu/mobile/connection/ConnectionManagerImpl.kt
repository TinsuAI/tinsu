package com.tinsu.mobile.connection

import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.HapticFeedback
import com.tinsu.mobile.util.Result
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.datetime.Clock

/**
 * Implementation of ConnectionManager with state tracking.
 * Manages SSH connections and exposes connection state via StateFlow.
 */
class ConnectionManagerImpl(
    private val connectionTester: ConnectionTester,
    private val remoteExecutor: RemoteExecutorContract,
    private val hapticFeedback: HapticFeedback,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
) : ConnectionManager {

    private val _connectionState = MutableStateFlow<ConnectionEvent>(ConnectionEvent.Offline)
    override val connectionState: StateFlow<ConnectionEvent> = _connectionState.asStateFlow()

    private var connectionJob: Job? = null
    private var connectionStartTime: Long? = null

    override suspend fun connect(config: ConnectionConfig) {
        // Cancel any existing connection attempt
        connectionJob?.cancel()

        connectionJob = scope.launch {
            try {
                // Update state to Reconnecting
                _connectionState.value = ConnectionEvent.Reconnecting
                // Trigger haptic feedback for reconnection warning
                hapticFeedback.warning()

                // Attempt connection with timeout wrapper for graceful recovery
                val result = withContext(Dispatchers.Default) {
                    try {
                        connectionTester.testConnection(config)
                    } catch (e: Exception) {
                        // Wrap any exception for graceful recovery (NFR12)
                        ConnectionTestResult.Failure(
                            errorType = when (e) {
                                is kotlinx.coroutines.TimeoutCancellationException -> ConnectionErrorType.TIMEOUT
                                else -> ConnectionErrorType.UNKNOWN
                            },
                            message = e.message ?: "Connection failed",
                            troubleshootingHints = listOf("An error occurred during connection.")
                        )
                    }
                }

                when (result) {
                    is ConnectionTestResult.Success -> {
                        // Connection successful - record start time and update state
                        connectionStartTime = Clock.System.now().toEpochMilliseconds()
                        _connectionState.value = ConnectionEvent.Connected(
                            host = config.host,
                            port = config.port,
                            transport = config.transportType,
                            uptime = 0
                        )
                        // Trigger haptic feedback for successful connection
                        hapticFeedback.connectionEstablished()
                    }
                    is ConnectionTestResult.Failure -> {
                        // Connection failed - update to Disconnected with reason
                        _connectionState.value = ConnectionEvent.Disconnected(
                            reason = result.message
                        )
                        // Trigger haptic feedback for connection loss
                        hapticFeedback.connectionLost()
                    }
                }
            } catch (e: Exception) {
                // Catch any unexpected errors for graceful recovery (NFR12)
                _connectionState.value = ConnectionEvent.Disconnected(
                    reason = e.message ?: "Unexpected connection error"
                )
            }
        }

        connectionJob?.join()
    }

    override suspend fun disconnect() {
        try {
            // Cancel any ongoing connection attempt
            connectionJob?.cancel()
            connectionJob = null

            // Disconnect the remote executor
            withContext(Dispatchers.Default) {
                try {
                    remoteExecutor.disconnect()
                } catch (e: Exception) {
                    // Ignore disconnect errors - we're cleaning up state
                }
            }

            // Clear connection start time
            connectionStartTime = null

            // Update state to Disconnected
            _connectionState.value = ConnectionEvent.Disconnected(
                reason = "Disconnected by user"
            )
        } catch (e: Exception) {
            // Ensure state is updated even if disconnect fails
            _connectionState.value = ConnectionEvent.Disconnected(
                reason = "Disconnect error: ${e.message}"
            )
        }
    }

    override suspend fun testConnection(config: ConnectionConfig): ConnectionTestResult {
        return try {
            // Test connection without changing state
            withContext(Dispatchers.Default) {
                connectionTester.testConnection(config)
            }
        } catch (e: Exception) {
            // Return failure result for graceful error handling (NFR12)
            ConnectionTestResult.Failure(
                errorType = when (e) {
                    is kotlinx.coroutines.TimeoutCancellationException -> ConnectionErrorType.TIMEOUT
                    else -> ConnectionErrorType.UNKNOWN
                },
                message = e.message ?: "Connection test failed",
                troubleshootingHints = listOf("An error occurred during connection test.")
            )
        }
    }

    /**
     * Updates the connection state externally.
     * Used by ConnectionMonitor to update state based on network changes.
     */
    fun updateConnectionState(state: ConnectionEvent) {
        _connectionState.value = state
    }

    /**
     * Gets the current uptime in milliseconds.
     * Returns 0 if not connected.
     */
    fun getCurrentUptime(): Long {
        val startTime = connectionStartTime ?: return 0
        val currentState = _connectionState.value
        if (currentState !is ConnectionEvent.Connected) return 0

        return Clock.System.now().toEpochMilliseconds() - startTime
    }
}
