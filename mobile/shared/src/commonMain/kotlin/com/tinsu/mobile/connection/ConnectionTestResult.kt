package com.tinsu.mobile.connection

sealed class ConnectionTestResult {
    data class Success(val sessionInfo: SessionInfo) : ConnectionTestResult()
    data class Failure(
        val errorType: ConnectionErrorType,
        val message: String,
        val troubleshootingHints: List<String>
    ) : ConnectionTestResult()
}
