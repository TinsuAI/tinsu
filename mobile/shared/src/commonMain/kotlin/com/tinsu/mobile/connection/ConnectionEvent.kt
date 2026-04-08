package com.tinsu.mobile.connection

/**
 * Sealed class hierarchy representing connection state events.
 * Used by ConnectionManager to expose current connection state via StateFlow.
 */
sealed class ConnectionEvent {
    /**
     * Connection is active and healthy.
     * @param host Remote host address
     * @param port SSH port number
     * @param transport Transport type (SSH or MOSH)
     * @param uptime Connection uptime in milliseconds
     */
    data class Connected(
        val host: String,
        val port: Int,
        val transport: TransportType,
        val uptime: Long = 0
    ) : ConnectionEvent()

    /**
     * Connection is being re-established after a temporary disruption.
     * The app is actively attempting to reconnect.
     */
    data object Reconnecting : ConnectionEvent()

    /**
     * Connection was lost or failed to establish.
     * @param reason Optional reason for disconnection (e.g., timeout, auth failed)
     */
    data class Disconnected(val reason: String? = null) : ConnectionEvent()

    /**
     * No network connectivity available.
     * Distinct from Disconnected — Offline means the device has no network,
     * while Disconnected means network exists but SSH connection failed.
     */
    data object Offline : ConnectionEvent()
}
