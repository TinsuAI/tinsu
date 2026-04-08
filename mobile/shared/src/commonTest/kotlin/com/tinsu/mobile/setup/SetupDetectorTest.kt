package com.tinsu.mobile.setup

import com.tinsu.mobile.connection.ConnectionConfig
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.util.Result
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

class SetupDetectorTest {

    // --- SetupStep enum ---

    @Test
    fun setupStep_allStepsPresent() {
        val steps = SetupStep.ALL_STEPS
        assertEquals(7, steps.size)
        assertEquals(SetupStep.WELCOME, steps[0])
        assertEquals(SetupStep.HOST_DETAILS, steps[1])
        assertEquals(SetupStep.GENERATE_KEY, steps[2])
        assertEquals(SetupStep.VIEW_PUBLIC_KEY, steps[3])
        assertEquals(SetupStep.AUTHORIZED_KEYS_INSTRUCTIONS, steps[4])
        assertEquals(SetupStep.TEST_CONNECTION, steps[5])
        assertEquals(SetupStep.SAVE_CONNECTION, steps[6])
    }

    @Test
    fun setupStep_indexMatchesPosition() {
        SetupStep.ALL_STEPS.forEachIndexed { index, step ->
            assertEquals(index, step.index)
        }
    }

    // --- SetupUiState ---

    @Test
    fun stepActive_holdsCorrectData() {
        val state = SetupUiState.StepActive(
            step = SetupStep.GENERATE_KEY,
            stepIndex = 2,
            totalSteps = 7
        )
        assertEquals(SetupStep.GENERATE_KEY, state.step)
        assertEquals(2, state.stepIndex)
        assertEquals(7, state.totalSteps)
    }

    @Test
    fun testSuccess_holdsSessionInfo() {
        val sessionInfo = com.tinsu.mobile.connection.SessionInfo(
            host = "192.168.1.1",
            port = 22,
            serverVersion = "OpenSSH_8.9",
            authenticatedAs = "ubuntu"
        )
        val state = SetupUiState.TestSuccess(sessionInfo)
        assertEquals("192.168.1.1", state.sessionInfo.host)
        assertEquals("ubuntu", state.sessionInfo.authenticatedAs)
    }

    @Test
    fun testFailure_holdsErrorDetails() {
        val state = SetupUiState.TestFailure(
            errorType = com.tinsu.mobile.connection.ConnectionErrorType.HOST_UNREACHABLE,
            message = "Cannot reach host",
            hints = listOf("Check IP address", "Verify network")
        )
        assertEquals(com.tinsu.mobile.connection.ConnectionErrorType.HOST_UNREACHABLE, state.errorType)
        assertEquals("Cannot reach host", state.message)
        assertEquals(2, state.hints.size)
    }

    @Test
    fun saving_holdsConfig() {
        val config = ConnectionConfig(
            displayName = "Test",
            host = "host",
            username = "user"
        )
        val state = SetupUiState.Saving(config)
        assertEquals("Test", state.config.displayName)
    }

    @Test
    fun completed_isDataObject() {
        val state = SetupUiState.Completed
        assertTrue(state is SetupUiState.Completed)
    }

    // --- SetupNavigator interface ---

    @Test
    fun setupNavigator_canBeImplemented() {
        val navigator = object : SetupNavigator {
            override fun navigateToConnectionList() {}
            override fun navigateToStep(step: SetupStep) {}
        }
        // Just verify the interface can be implemented
        navigator.navigateToConnectionList()
        navigator.navigateToStep(SetupStep.WELCOME)
    }
}
