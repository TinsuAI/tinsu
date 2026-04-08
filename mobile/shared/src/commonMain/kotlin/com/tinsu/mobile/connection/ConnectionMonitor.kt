package com.tinsu.mobile.connection

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.datetime.Clock
import kotlin.math.min
import kotlin.math.pow

/**
 * Monitors connection health and manages automatic reconnection.
 * Performs periodic health checks and implements exponential backoff.
 */
class ConnectionMonitor(
    private val connectionManager: ConnectionManagerImpl,
    private val remoteExecutor: RemoteExecutorContract,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
) {
    // Health check interval when connected
    private val healthCheckIntervalMs = 30000L // 30 seconds

    // Exponential backoff configuration
    private val baseRetryDelayMs = 1000L // 1 second
    private val maxRetryDelayMs = 30000L // 30 seconds
    private val maxRetryAttempts = 5

    // Ping command for health checks
    private val pingCommand = "echo 'tinsu-ping'"

    // Monitoring state
    private var monitoringJob: Job? = null
    private var reconnectJob: Job? = null
    private var retryAttempt = 0
    private var lastConnectedConfig: ConnectionConfig? = null

    // Network state tracking
    private val _networkAvailable = MutableStateFlow(true)
    val networkAvailable: StateFlow<Boolean> = _networkAvailable.asStateFlow()

    // Latency tracking
    private val _latency = MutableStateFlow<Long?>(null)
    val latency: StateFlow<Long?> = _latency.asStateFlow()

    /**
     * Starts monitoring the connection.
     * Begins periodic health checks when in Connected state.
     */
    fun startMonitoring() {
        monitoringJob?.cancel()
        monitoringJob = scope.launch {
            connectionManager.connectionState.collect { state ->
                when (state) {
                    is ConnectionEvent.Connected -> {
                        // Start health checks for active connection
                        lastConnectedConfig = ConnectionConfig(
                            displayName = "Active",
                            host = state.host,
                            port = state.port,
                            username = "", // Not used for health checks
                            transportType = state.transport
                        )
                        startHealthChecks()
                    }
                    is ConnectionEvent.Disconnected -> {
                        // Stop health checks on disconnection
                        stopHealthChecks()
                        _latency.value = null
                    }
                    is ConnectionEvent.Reconnecting -> {
                        // Reconnection in progress - wait for result
                    }
                    is ConnectionEvent.Offline -> {
                        // Network unavailable - stop monitoring
                        stopHealthChecks()
                        _latency.value = null
                    }
                }
            }
        }
    }

    /**
     * Stops monitoring the connection.
     */
    fun stopMonitoring() {
        monitoringJob?.cancel()
        stopHealthChecks()
        reconnectJob?.cancel()
    }

    /**
     * Updates network availability.
     * Called by platform-specific network callbacks.
     */
    fun updateNetworkState(available: Boolean) {
        _networkAvailable.value = available

        if (!available) {
            // Network lost - transition to Offline
            connectionManager.updateConnectionState(ConnectionEvent.Offline)
            stopHealthChecks()
            reconnectJob?.cancel()
        } else {
            // Network restored - if we were disconnected, try to reconnect
            if (connectionManager.connectionState.value is ConnectionEvent.Offline) {
                lastConnectedConfig?.let { config ->
                    startReconnection(config)
                }
            }
        }
    }

    /**
     * Starts periodic health checks for the current connection.
     */
    private fun startHealthChecks() {
        stopHealthChecks() // Cancel any existing health checks

        scope.launch {
            while (connectionManager.connectionState.value is ConnectionEvent.Connected) {
                delay(healthCheckIntervalMs)

                val state = connectionManager.connectionState.value
                if (state is ConnectionEvent.Connected) {
                    performHealthCheck(state)
                }
            }
        }
    }

    /**
     * Stops health checks.
     */
    private fun stopHealthChecks() {
        // Health checks run in a coroutine that checks connectionState
        // No explicit cancellation needed - the loop exits when state changes
    }

    /**
     * Performs a health check on the connection.
     * Sends a ping command and measures latency.
     */
    private suspend fun performHealthCheck(state: ConnectionEvent.Connected) {
        try {
            val startTime = Clock.System.now().toEpochMilliseconds()

            val result = withContext(Dispatchers.Default) {
                try {
                    remoteExecutor.exec(pingCommand)
                } catch (e: Exception) {
                    null
                }
            }

            val endTime = Clock.System.now().toEpochMilliseconds()
            val pingLatency = endTime - startTime

            if (result != null && result.exitCode == 0) {
                // Health check passed - update latency
                _latency.value = pingLatency

                // Update uptime
                val currentUptime = connectionManager.getCurrentUptime()
                connectionManager.updateConnectionState(
                    state.copy(uptime = currentUptime)
                )
            } else {
                // Health check failed - initiate reconnection
                lastConnectedConfig?.let { config ->
                    startReconnection(config)
                }
            }
        } catch (e: Exception) {
            // Health check error - initiate reconnection
            lastConnectedConfig?.let { config ->
                startReconnection(config)
            }
        }
    }

    /**
     * Starts reconnection with exponential backoff.
     */
    private fun startReconnection(config: ConnectionConfig) {
        reconnectJob?.cancel()
        retryAttempt = 0

        reconnectJob = scope.launch {
            while (retryAttempt < maxRetryAttempts) {
                // Check if network is still available
                if (!_networkAvailable.value) {
                    connectionManager.updateConnectionState(ConnectionEvent.Offline)
                    break
                }

                // Transition to Reconnecting
                connectionManager.updateConnectionState(ConnectionEvent.Reconnecting)

                // Calculate backoff delay
                val backoffDelay = min(
                    baseRetryDelayMs * 2.0.pow(retryAttempt).toLong(),
                    maxRetryDelayMs
                )

                delay(backoffDelay)

                // Attempt reconnection
                val result = withContext(Dispatchers.Default) {
                    try {
                        connectionManager.testConnection(config)
                    } catch (e: Exception) {
                        ConnectionTestResult.Failure(
                            errorType = ConnectionErrorType.UNKNOWN,
                            message = e.message ?: "Reconnection failed",
                            troubleshootingHints = emptyList()
                        )
                    }
                }

                when (result) {
                    is ConnectionTestResult.Success -> {
                        // Reconnection successful
                        connectionManager.connect(config)
                        break
                    }
                    is ConnectionTestResult.Failure -> {
                        // Reconnection failed - retry if we haven't exhausted attempts
                        retryAttempt++
                        if (retryAttempt >= maxRetryAttempts) {
                            // Max retries reached - give up
                            connectionManager.updateConnectionState(
                                ConnectionEvent.Disconnected(
                                    reason = "Reconnection failed after $maxRetryAttempts attempts"
                                )
                            )
                            break
                        }
                    }
                }
            }
        }
    }

    companion object {
        /**
         * Formats uptime in milliseconds to human-readable string.
         * Returns "< 1m" for <60s, "Xm Ys" for <1h, "Xh Ym" for ≥1h.
         */
        fun formatUptime(uptimeMs: Long): String {
            val totalSeconds = uptimeMs / 1000
            val hours = totalSeconds / 3600
            val minutes = (totalSeconds % 3600) / 60
            val seconds = totalSeconds % 60

            return when {
                totalSeconds < 60 -> "< 1m"
                hours > 0 -> "${hours}h ${minutes}m"
                else -> "${minutes}m ${seconds}s"
            }
        }
    }
}
