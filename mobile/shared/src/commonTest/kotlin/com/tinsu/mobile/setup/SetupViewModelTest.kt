package com.tinsu.mobile.setup

import com.tinsu.mobile.connection.ConnectionConfig
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.ConnectionTestResult
import com.tinsu.mobile.connection.ConnectionTester
import com.tinsu.mobile.connection.SessionInfo
import com.tinsu.mobile.security.KeyType
import com.tinsu.mobile.security.SecureKeyStoreContract
import com.tinsu.mobile.security.SshKeyPair
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

class SetupViewModelTest {

    private fun createViewModel(
        secureKeyStore: SecureKeyStoreContract = StubKeyStore(),
        connectionTester: ConnectionTester = StubTester(),
        repository: ConnectionRepository = StubRepository()
    ): SetupViewModel {
        return SetupViewModel(
            connectionRepository = repository,
            secureKeyStore = secureKeyStore,
            connectionTester = connectionTester,
            setupDetector = StubSetupDetector()
        )
    }

    // --- Initial state ---

    @Test
    fun initialState_isWelcomeStep() {
        val vm = createViewModel()
        val state = vm.uiState.value as SetupUiState.StepActive
        assertEquals(SetupStep.WELCOME, state.step)
        assertEquals(0, state.stepIndex)
        assertEquals(SetupStep.TOTAL_STEPS, state.totalSteps)
    }

    @Test
    fun initialHostDetailsAreDefaults() {
        val vm = createViewModel()
        assertEquals("", vm.host)
        assertEquals(22, vm.port)
        assertEquals("", vm.username)
        assertNull(vm.sshKeyAlias)
        assertNull(vm.publicKeyText)
    }

    // --- Navigation ---

    @Test
    fun nextStep_advancesToHostDetails() {
        val vm = createViewModel()
        vm.nextStep()
        val state = vm.uiState.value as SetupUiState.StepActive
        assertEquals(SetupStep.HOST_DETAILS, state.step)
        assertEquals(1, state.stepIndex)
    }

    @Test
    fun previousStep_onWelcome_doesNothing() {
        val vm = createViewModel()
        vm.previousStep()
        val state = vm.uiState.value as SetupUiState.StepActive
        assertEquals(SetupStep.WELCOME, state.step)
    }

    @Test
    fun previousStep_goesBackToPreviousStep() {
        val vm = createViewModel()
        vm.nextStep() // HOST_DETAILS
        vm.previousStep()
        val state = vm.uiState.value as SetupUiState.StepActive
        assertEquals(SetupStep.WELCOME, state.step)
    }

    @Test
    fun nextStep_cannotExceedTotalSteps() {
        val vm = createViewModel()
        // Navigate to last step
        repeat(SetupStep.TOTAL_STEPS) { vm.nextStep() }
        val state = vm.uiState.value as SetupUiState.StepActive
        // Should be at SAVE_CONNECTION (index 6)
        assertEquals(SetupStep.SAVE_CONNECTION, state.step)
    }

    // --- Host details ---

    @Test
    fun setHostDetails_storesValues() {
        val vm = createViewModel()
        vm.setHostDetails("192.168.1.1", 2222, "admin")
        assertEquals("192.168.1.1", vm.host)
        assertEquals(2222, vm.port)
        assertEquals("admin", vm.username)
    }

    @Test
    fun setHostDetails_trimsWhitespace() {
        val vm = createViewModel()
        vm.setHostDetails("  host  ", 22, "  user  ")
        assertEquals("host", vm.host)
        assertEquals("user", vm.username)
    }

    @Test
    fun areHostDetailsValid_requiresHostAndUsername() {
        val vm = createViewModel()
        assertFalse(vm.areHostDetailsValid())
        vm.setHostDetails("host", 22, "user")
        assertTrue(vm.areHostDetailsValid())
    }

    @Test
    fun areHostDetailsValid_requiresValidPort() {
        val vm = createViewModel()
        vm.setHostDetails("host", 0, "user")
        assertFalse(vm.areHostDetailsValid())
        vm.setHostDetails("host", 65536, "user")
        assertFalse(vm.areHostDetailsValid())
    }

    // --- Key generation ---

    @Test
    fun generateKey_storesAliasAndPublicKey() = runTest {
        val vm = createViewModel(secureKeyStore = StubKeyStore(generatedAlias = "test-key"))
        vm.generateKey()
        // Give coroutine time to complete
        kotlinx.coroutines.test.advanceUntilIdle()
        assertEquals("test-key", vm.sshKeyAlias)
        assertNotNull(vm.publicKeyText)
    }

    @Test
    fun getPublicKey_returnsPublicKeyText() = runTest {
        val vm = createViewModel(secureKeyStore = StubKeyStore(generatedAlias = "key"))
        vm.generateKey()
        kotlinx.coroutines.test.advanceUntilIdle()
        assertNotNull(vm.getPublicKey())
    }

    @Test
    fun generateKey_onFailure_setsAliasToNull() = runTest {
        val vm = createViewModel(secureKeyStore = StubKeyStore(shouldFail = true))
        vm.generateKey()
        kotlinx.coroutines.test.advanceUntilIdle()
        assertNull(vm.sshKeyAlias)
    }

    // --- Connection testing ---

    @Test
    fun testConnection_withoutKeyAlias_doesNotTest() = runTest {
        val vm = createViewModel()
        vm.testConnection()
        // Should stay on WELCOME since no key alias set
        val state = vm.uiState.value as SetupUiState.StepActive
        assertEquals(SetupStep.WELCOME, state.step)
    }

    @Test
    fun testConnection_success_setsTestSuccessState() = runTest {
        val sessionInfo = SessionInfo("host", 22, "OpenSSH", "user")
        val vm = createViewModel(
            secureKeyStore = StubKeyStore(generatedAlias = "key"),
            connectionTester = StubTester(testResult = ConnectionTestResult.Success(sessionInfo))
        )
        vm.setHostDetails("host", 22, "user")
        vm.generateKey()
        kotlinx.coroutines.test.advanceUntilIdle()
        vm.testConnection()
        kotlinx.coroutines.test.advanceUntilIdle()
        val state = vm.uiState.value
        assertTrue(state is SetupUiState.TestSuccess)
        assertEquals("user", state.sessionInfo.authenticatedAs)
    }

    @Test
    fun testConnection_failure_setsTestFailureState() = runTest {
        val vm = createViewModel(
            secureKeyStore = StubKeyStore(generatedAlias = "key"),
            connectionTester = StubTester(testResult = ConnectionTestResult.Failure(
                com.tinsu.mobile.connection.ConnectionErrorType.AUTH_FAILED,
                "Auth failed",
                listOf("Check your key")
            ))
        )
        vm.setHostDetails("host", 22, "user")
        vm.generateKey()
        kotlinx.coroutines.test.advanceUntilIdle()
        vm.testConnection()
        kotlinx.coroutines.test.advanceUntilIdle()
        val state = vm.uiState.value
        assertTrue(state is SetupUiState.TestFailure)
        assertEquals("Auth failed", state.message)
    }

    @Test
    fun retryTest_resetsToStepActive() = runTest {
        val vm = createViewModel(
            secureKeyStore = StubKeyStore(generatedAlias = "key"),
            connectionTester = StubTester(testResult = ConnectionTestResult.Failure(
                com.tinsu.mobile.connection.ConnectionErrorType.AUTH_FAILED,
                "Auth failed",
                emptyList()
            ))
        )
        vm.setHostDetails("host", 22, "user")
        vm.generateKey()
        kotlinx.coroutines.test.advanceUntilIdle()
        vm.testConnection()
        kotlinx.coroutines.test.advanceUntilIdle()
        vm.retryTest()
        val state = vm.uiState.value as SetupUiState.StepActive
        assertEquals(SetupStep.TEST_CONNECTION, state.step)
    }

    // --- Proceed after test ---

    @Test
    fun proceedAfterTestSuccess_movesToSaveConnection() = runTest {
        val sessionInfo = SessionInfo("host", 22, "OpenSSH", "user")
        val vm = createViewModel(
            secureKeyStore = StubKeyStore(generatedAlias = "key"),
            connectionTester = StubTester(testResult = ConnectionTestResult.Success(sessionInfo))
        )
        vm.setHostDetails("host", 22, "user")
        vm.generateKey()
        kotlinx.coroutines.test.advanceUntilIdle()
        vm.testConnection()
        kotlinx.coroutines.test.advanceUntilIdle()
        vm.proceedAfterTestSuccess()
        val state = vm.uiState.value as SetupUiState.StepActive
        assertEquals(SetupStep.SAVE_CONNECTION, state.step)
    }

    // --- Save connection ---

    @Test
    fun skipSetup_completesFlow() {
        val vm = createViewModel()
        vm.skipSetup()
        assertTrue(vm.uiState.value is SetupUiState.Completed)
    }

    // --- Display name ---

    @Test
    fun setDisplayName_storesName() {
        val vm = createViewModel()
        vm.setDisplayName("My Server")
        assertEquals("My Server", vm.displayName)
    }

    @Test
    fun setDisplayName_trimsWhitespace() {
        val vm = createViewModel()
        vm.setDisplayName("  My Server  ")
        assertEquals("My Server", vm.displayName)
    }

    // --- goToStep ---

    @Test
    fun goToStep_navigatesToSpecificStep() {
        val vm = createViewModel()
        vm.goToStep(SetupStep.GENERATE_KEY)
        val state = vm.uiState.value as SetupUiState.StepActive
        assertEquals(SetupStep.GENERATE_KEY, state.step)
    }

    // --- SetupStep enum ---

    @Test
    fun setupStep_totalStepsIs7() {
        assertEquals(7, SetupStep.TOTAL_STEPS)
    }

    @Test
    fun setupStep_fromIndex_returnsCorrectStep() {
        assertEquals(SetupStep.WELCOME, SetupStep.fromIndex(0))
        assertEquals(SetupStep.HOST_DETAILS, SetupStep.fromIndex(1))
        assertEquals(SetupStep.SAVE_CONNECTION, SetupStep.fromIndex(6))
    }

    @Test
    fun setupStep_fromInvalidIndex_returnsWelcome() {
        assertEquals(SetupStep.WELCOME, SetupStep.fromIndex(-1))
        assertEquals(SetupStep.WELCOME, SetupStep.fromIndex(999))
    }

    // --- SetupUiState sealed class ---

    @Test
    fun setupUiState_allVariantsExist() {
        val active = SetupUiState.StepActive(SetupStep.WELCOME, 0, 7)
        val config = ConnectionConfig(displayName = "Test", host = "h", username = "u")
        val testing = SetupUiState.Testing(config)
        val success = SetupUiState.TestSuccess(SessionInfo("h", 22, "v", "u"))
        val failure = SetupUiState.TestFailure(
            com.tinsu.mobile.connection.ConnectionErrorType.UNKNOWN, "err", listOf("hint")
        )
        val saving = SetupUiState.Saving(config)
        val completed = SetupUiState.Completed

        assertEquals(SetupStep.WELCOME, active.step)
        assertTrue(testing is SetupUiState.Testing)
        assertTrue(success is SetupUiState.TestSuccess)
        assertTrue(failure is SetupUiState.TestFailure)
        assertTrue(saving is SetupUiState.Saving)
        assertTrue(completed is SetupUiState.Completed)
    }
}

// --- Fakes ---

private class StubKeyStore(
    private val generatedAlias: String? = null,
    private val shouldFail: Boolean = false
) : SecureKeyStoreContract {

    override suspend fun generateKeyPair(alias: String, keyType: KeyType): Result<SshKeyPair> {
        return if (shouldFail) {
            Result.Failure(AppError.KeyGenerationFailed("Test failure"))
        } else {
            Result.Success(SshKeyPair(generatedAlias ?: alias, keyType, "ssh-ed25519 AAAA... key", kotlinx.datetime.Clock.System.now()))
        }
    }

    override suspend fun getPublicKey(alias: String): Result<String> {
        return if (shouldFail) {
            Result.Failure(AppError.KeyNotFound(alias))
        } else {
            Result.Success("ssh-ed25519 AAAA... $alias")
        }
    }

    override suspend fun hasKey(alias: String): Result<Boolean> = Result.Success(true)
    override suspend fun getKeyType(alias: String): Result<KeyType> = Result.Success(KeyType.Ed25519)
    override suspend fun getPrivateKeyData(alias: String): Result<ByteArray> = Result.Success(ByteArray(0))
}

private class StubTester(
    private val testResult: ConnectionTestResult = ConnectionTestResult.Success(
        SessionInfo("host", 22, "OpenSSH", "user")
    )
) : ConnectionTester(
    remoteExecutor = object : com.tinsu.mobile.connection.RemoteExecutorContract {
        override suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<SessionInfo> =
            Result.Success(SessionInfo(host, port, "OpenSSH", username))
        override suspend fun exec(command: String) = com.tinsu.mobile.connection.CommandResult(0, "tinsu-test\n", "")
        override suspend fun disconnect() {}
        override fun isConnected() = false
    },
    secureKeyStore = StubKeyStore()
) {
    override suspend fun testWithRetry(config: ConnectionConfig, maxAttempts: Int): ConnectionTestResult = testResult
}

private class StubRepository : ConnectionRepository {
    override suspend fun getAllConnections(): Result<List<ConnectionConfig>> = Result.Success(emptyList())
    override suspend fun createConnection(config: ConnectionConfig): Result<ConnectionConfig> = Result.Success(config)
    override suspend fun updateConnection(config: ConnectionConfig): Result<ConnectionConfig> = Result.Success(config)
    override suspend fun deleteConnection(id: String): Result<Unit> = Result.Success(Unit)
    override suspend fun reorderConnectionIds(ids: List<String>): Result<Unit> = Result.Success(Unit)
}

private class StubSetupDetector : SetupDetector(
    repository = object : ConnectionRepository {
        override suspend fun getAllConnections(): Result<List<ConnectionConfig>> = Result.Success(emptyList())
        override suspend fun createConnection(config: ConnectionConfig): Result<ConnectionConfig> = Result.Success(config)
        override suspend fun updateConnection(config: ConnectionConfig): Result<ConnectionConfig> = Result.Success(config)
        override suspend fun deleteConnection(id: String): Result<Unit> = Result.Success(Unit)
        override suspend fun reorderConnectionIds(ids: List<String>): Result<Unit> = Result.Success(Unit)
    },
    database = object : com.tinsu.mobile.db.TinsuMobile(
        driver = object : app.cash.sqldelight.db.SqlDriver {
            override fun executeQuery(identifier: Int?, sql: String, parameters: Int, binders: (app.cash.sqldelight.db.SqlPreparedStatement.() -> Unit)?): app.cash.sqldelight.db.QueryResult.Value<Long> =
                app.cash.sqldelight.db.QueryResult.Value(0)
            override fun execute(identifier: Int?, sql: String, parameters: Int, binders: (app.cash.sqldelight.db.SqlPreparedStatement.() -> Unit)?): app.cash.sqldelight.db.QueryResult.Value<Long> =
                app.cash.sqldelight.db.QueryResult.Value(0)
            override fun addListener(listener: app.cash.sqldelight.db.SqlDriver.Listener, queryKeys: Array<String>) {}
            override fun removeListener(listener: app.cash.sqldelight.db.SqlDriver.Listener, queryKeys: Array<String>) {}
            override fun notifyListeners(queryKeys: Array<String>) {}
            override fun close() {}
        }
    ) {}
) {
    // Note: StubSetupDetector delegates to a real SetupDetector with stub deps.
    // For navigation tests, we just need the ViewModel to not crash.
}
