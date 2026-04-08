package com.tinsu.mobile.connection

import kotlinx.coroutines.flow.StateFlow

/**
 * Manages SSH connection lifecycle and exposes connection state.
 * Wraps ConnectionRepository and ConnectionTester to provide unified state management.
 */
interface ConnectionManager {
    /**
     * Current connection state as a StateFlow.
     * Emits state changes: Offline → Reconnecting → Connected/Disconnected
     */
    val connectionState: StateFlow<ConnectionEvent>

    /**
     * Initiates a connection to the specified configuration.
     * Updates connectionState to Reconnecting, then Connected or Disconnected.
     */
    suspend fun connect(config: ConnectionConfig)

    /**
     * Disconnects the current connection.
     * Updates connectionState to Disconnected.
     */
    suspend fun disconnect()

    /**
     * Tests connectivity without changing state.
     * Returns ConnectionTestResult but does not update connectionState.
     */
    suspend fun testConnection(config: ConnectionConfig): ConnectionTestResult
}
