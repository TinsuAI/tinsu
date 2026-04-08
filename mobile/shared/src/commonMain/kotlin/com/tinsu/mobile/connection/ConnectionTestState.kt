package com.tinsu.mobile.connection

/**
 * Sealed class representing the state of a connection test.
 */
sealed class ConnectionTestState {
    data object Idle : ConnectionTestState()
    data object Testing : ConnectionTestState()
    data class Success(val sessionInfo: SessionInfo) : ConnectionTestState()
    data class Failure(
        val errorType: ConnectionErrorType,
        val message: String,
        val hints: List<String>
    ) : ConnectionTestState()
}
