package com.tinsu.mobile.setup

import com.tinsu.mobile.connection.ConnectionConfig
import com.tinsu.mobile.connection.ConnectionErrorType
import com.tinsu.mobile.connection.SessionInfo

sealed class SetupUiState {
    data class StepActive(
        val step: SetupStep,
        val stepIndex: Int,
        val totalSteps: Int
    ) : SetupUiState()

    data class Testing(
        val config: ConnectionConfig
    ) : SetupUiState()

    data class TestSuccess(
        val sessionInfo: SessionInfo
    ) : SetupUiState()

    data class TestFailure(
        val errorType: ConnectionErrorType,
        val message: String,
        val hints: List<String>
    ) : SetupUiState()

    data class Saving(
        val config: ConnectionConfig
    ) : SetupUiState()

    data object Completed : SetupUiState()
}
