package com.tinsu.mobile.connection

import com.tinsu.mobile.util.Result
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * UI state for the connection list screen.
 */
data class ConnectionListUiState(
    val isLoading: Boolean = false,
    val connections: List<ConnectionConfig> = emptyList(),
    val error: String? = null,
    val isEmpty: Boolean = false,
    val connectionState: ConnectionEvent = ConnectionEvent.Offline
)

/**
 * ViewModel for managing the connection list screen state.
 */
class ConnectionListViewModel(
    private val repository: ConnectionRepository,
    private val connectionTester: ConnectionTester? = null,
    private val connectionManager: ConnectionManager
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _uiState = MutableStateFlow(ConnectionListUiState())
    val uiState: StateFlow<ConnectionListUiState> = _uiState.asStateFlow()

    private val _testState = MutableStateFlow<Map<String, ConnectionTestState>>(emptyMap())
    val testState: StateFlow<Map<String, ConnectionTestState>> = _testState.asStateFlow()

    private val _testedConnectionIds = mutableSetOf<String>()

    init {
        loadConnections()
        // Observe connection state from ConnectionManager
        viewModelScope.launch {
            try {
                connectionManager.connectionState.collect { connectionEvent ->
                    val current = _uiState.value
                    _uiState.value = current.copy(
                        isLoading = current.isLoading,
                        connections = current.connections,
                        error = current.error,
                        isEmpty = current.isEmpty,
                        connectionState = connectionEvent
                    )
                }
            } catch (e: Exception) {
                // Log error but don't crash - state collection will restart on ViewModel recreation
            }
        }
    }

    /**
     * Loads all connections from the repository.
     */
    fun loadConnections() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                error = null
            )

            when (val result = repository.getAllConnections()) {
                is Result.Success -> {
                    _uiState.value = ConnectionListUiState(
                        isLoading = false,
                        connections = result.data,
                        isEmpty = result.data.isEmpty()
                    )
                }
                is Result.Failure -> {
                    _uiState.value = ConnectionListUiState(
                        isLoading = false,
                        connections = emptyList(),
                        error = result.error.userMessage,
                        isEmpty = false
                    )
                }
            }
        }
    }

    /**
     * Deletes a connection by its ID.
     */
    fun deleteConnection(id: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                error = null
            )

            when (val result = repository.deleteConnection(id)) {
                is Result.Success -> {
                    // Reload the list after deletion
                    loadConnections()
                }
                is Result.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.error.userMessage
                    )
                }
            }
        }
    }

    /**
     * Reorders connections by their IDs.
     */
    fun reorderConnections(ids: List<String>) {
        viewModelScope.launch {
            when (val result = repository.reorderConnectionIds(ids)) {
                is Result.Success -> {
                    // Reload the list after reorder
                    loadConnections()
                }
                is Result.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        error = result.error.userMessage
                    )
                }
            }
        }
    }

    /**
     * Tests a connection and updates the test state flow.
     * For new connections (id == null), uses a sentinel key to track state.
     */
    fun testConnection(config: ConnectionConfig) {
        val tester = connectionTester ?: return
        val stateKey = config.id ?: "__new_${config.host}_${config.port}"

        viewModelScope.launch {
            _testState.value = _testState.value + (stateKey to ConnectionTestState.Testing)

            val result = tester.testWithRetry(config)

            val state = when (result) {
                is ConnectionTestResult.Success -> {
                    _testedConnectionIds.add(stateKey)
                    ConnectionTestState.Success(result.sessionInfo)
                }
                is ConnectionTestResult.Failure ->
                    ConnectionTestState.Failure(result.errorType, result.message, result.troubleshootingHints)
            }
            _testState.value = _testState.value + (stateKey to state)
        }
    }

    /**
     * Returns whether a connection has been successfully tested.
     * Used by UI to enforce mandatory test-before-save for new connections.
     */
    fun isConnectionTested(connectionId: String?): Boolean {
        val key = connectionId ?: return false
        return _testedConnectionIds.contains(key)
    }

    /**
     * Gets the test state for a specific connection.
     */
    fun getTestState(connectionId: String?): ConnectionTestState {
        if (connectionId == null) return ConnectionTestState.Idle
        return _testState.value[connectionId] ?: ConnectionTestState.Idle
    }

    /**
     * Clears the current error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
