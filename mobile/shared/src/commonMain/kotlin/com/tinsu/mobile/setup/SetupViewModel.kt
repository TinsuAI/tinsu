package com.tinsu.mobile.setup

import com.tinsu.mobile.connection.ConnectionConfig
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.ConnectionTester
import com.tinsu.mobile.connection.SessionInfo
import com.tinsu.mobile.security.KeyType
import com.tinsu.mobile.security.SecureKeyStore
import com.tinsu.mobile.util.Result
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SetupViewModel(
    private val connectionRepository: ConnectionRepository,
    private val secureKeyStore: SecureKeyStore,
    private val connectionTester: ConnectionTester,
    private val setupDetector: SetupDetector
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _uiState = MutableStateFlow<SetupUiState>(
        SetupUiState.StepActive(
            step = SetupStep.WELCOME,
            stepIndex = SetupStep.WELCOME.index,
            totalSteps = SetupStep.TOTAL_STEPS
        )
    )
    val uiState: StateFlow<SetupUiState> = _uiState.asStateFlow()

    // Accumulated data across steps
    var host: String = ""
        private set
    var port: Int = 22
        private set
    var username: String = ""
        private set
    var sshKeyAlias: String? = null
        private set
    var publicKeyText: String? = null
        private set
    var displayName: String = ""
        private set
    var testSessionInfo: SessionInfo? = null
        private set

    init {
        // Resume from saved progress if available
        val savedStepIndex = setupDetector.getSetupProgress()
        if (savedStepIndex != null && savedStepIndex > 0) {
            val step = SetupStep.fromIndex(savedStepIndex)
            _uiState.value = SetupUiState.StepActive(
                step = step,
                stepIndex = step.index,
                totalSteps = SetupStep.TOTAL_STEPS
            )
        }
    }

    fun nextStep() {
        val currentState = _uiState.value
        if (currentState !is SetupUiState.StepActive) return

        val nextIndex = currentState.stepIndex + 1
        if (nextIndex >= SetupStep.TOTAL_STEPS) return

        val nextStep = SetupStep.fromIndex(nextIndex)
        setupDetector.saveSetupProgress(nextIndex)
        _uiState.value = SetupUiState.StepActive(
            step = nextStep,
            stepIndex = nextIndex,
            totalSteps = SetupStep.TOTAL_STEPS
        )
    }

    fun previousStep() {
        val currentState = _uiState.value
        if (currentState !is SetupUiState.StepActive) return

        val prevIndex = currentState.stepIndex - 1
        if (prevIndex < 0) return

        val prevStep = SetupStep.fromIndex(prevIndex)
        setupDetector.saveSetupProgress(prevIndex)
        _uiState.value = SetupUiState.StepActive(
            step = prevStep,
            stepIndex = prevIndex,
            totalSteps = SetupStep.TOTAL_STEPS
        )
    }

    fun setHostDetails(host: String, port: Int, username: String) {
        this.host = host.trim()
        this.port = port
        this.username = username.trim()
    }

    fun areHostDetailsValid(): Boolean {
        return host.isNotBlank() && username.isNotBlank() && port in 1..65535
    }

    fun generateKey(keyType: KeyType = KeyType.Ed25519) {
        viewModelScope.launch {
            val alias = "tinsu-mobile-${Clock.System.now().toEpochMilliseconds()}"
            when (val result = secureKeyStore.generateKeyPair(alias, keyType)) {
                is Result.Success -> {
                    sshKeyAlias = result.data.alias
                    // Immediately fetch the public key
                    when (val pubResult = secureKeyStore.getPublicKey(alias)) {
                        is Result.Success -> {
                            publicKeyText = pubResult.data
                        }
                        is Result.Failure -> {
                            publicKeyText = null
                        }
                    }
                }
                is Result.Failure -> {
                    sshKeyAlias = null
                    publicKeyText = null
                }
            }
        }
    }

    fun getPublicKey(): String? = publicKeyText

    var clipboardText: String? = null
        private set

    fun copyPublicKeyToClipboard() {
        clipboardText = publicKeyText
    }

    fun testConnection() {
        val alias = sshKeyAlias ?: return
        // Guard against concurrent test calls
        if (_uiState.value is SetupUiState.Testing) return

        val config = ConnectionConfig(
            displayName = "",
            host = host,
            port = port,
            username = username,
            sshKeyAlias = alias
        )

        viewModelScope.launch {
            _uiState.value = SetupUiState.Testing(config)

            val result = connectionTester.testWithRetry(config)
            when (result) {
                is com.tinsu.mobile.connection.ConnectionTestResult.Success -> {
                    testSessionInfo = result.sessionInfo
                    _uiState.value = SetupUiState.TestSuccess(result.sessionInfo)
                }
                is com.tinsu.mobile.connection.ConnectionTestResult.Failure -> {
                    _uiState.value = SetupUiState.TestFailure(
                        errorType = result.errorType,
                        message = result.message,
                        hints = result.troubleshootingHints
                    )
                }
            }
        }
    }

    fun retryTest() {
        _uiState.value = SetupUiState.StepActive(
            step = SetupStep.TEST_CONNECTION,
            stepIndex = SetupStep.TEST_CONNECTION.index,
            totalSteps = SetupStep.TOTAL_STEPS
        )
    }

    fun proceedAfterTestSuccess() {
        _uiState.value = SetupUiState.StepActive(
            step = SetupStep.SAVE_CONNECTION,
            stepIndex = SetupStep.SAVE_CONNECTION.index,
            totalSteps = SetupStep.TOTAL_STEPS
        )
        setupDetector.saveSetupProgress(SetupStep.SAVE_CONNECTION.index)
    }

    fun setDisplayName(name: String) {
        displayName = name.trim()
    }

    fun saveConnection() {
        val alias = sshKeyAlias ?: return
        val config = ConnectionConfig(
            displayName = displayName,
            host = host,
            port = port,
            username = username,
            sshKeyAlias = alias
        )

        viewModelScope.launch {
            _uiState.value = SetupUiState.Saving(config)

            when (val result = connectionRepository.createConnection(config)) {
                is Result.Success -> {
                    setupDetector.markSetupCompleted()
                    setupDetector.clearSetupProgress()
                    _uiState.value = SetupUiState.Completed
                }
                is Result.Failure -> {
                    // Go back to save step on failure
                    _uiState.value = SetupUiState.StepActive(
                        step = SetupStep.SAVE_CONNECTION,
                        stepIndex = SetupStep.SAVE_CONNECTION.index,
                        totalSteps = SetupStep.TOTAL_STEPS
                    )
                }
            }
        }
    }

    fun skipSetup() {
        setupDetector.markSetupSkipped()
        setupDetector.clearSetupProgress()
        _uiState.value = SetupUiState.Completed
    }

    fun goToStep(step: SetupStep) {
        setupDetector.saveSetupProgress(step.index)
        _uiState.value = SetupUiState.StepActive(
            step = step,
            stepIndex = step.index,
            totalSteps = SetupStep.TOTAL_STEPS
        )
    }
}

private val Clock: kotlinx.datetime.Clock
    get() = kotlinx.datetime.Clock.System
