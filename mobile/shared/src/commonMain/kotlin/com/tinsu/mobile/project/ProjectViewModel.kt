package com.tinsu.mobile.project

import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.RemoteExecutor
import com.tinsu.mobile.connection.RemoteExecutorContract
import com.tinsu.mobile.util.Result
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ProjectUiState {
    data object Idle : ProjectUiState()
    data object Loading : ProjectUiState()
    data class ProjectsLoaded(
        val projects: List<ProjectInfo>,
        val selectedProject: ProjectInfo?
    ) : ProjectUiState()

    data class Error(
        val message: String,
        val isNotFoundError: Boolean
    ) : ProjectUiState()
}

class ProjectViewModel(
    private val projectRepository: ProjectRepository,
    private val remoteExecutor: RemoteExecutor,
    private val connectionRepository: ConnectionRepository
) {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _uiState = MutableStateFlow<ProjectUiState>(ProjectUiState.Idle)
    val uiState: StateFlow<ProjectUiState> = _uiState.asStateFlow()

    private var connectedExecutor: RemoteExecutorContract? = null
    private var discoveryJob: Job? = null

    init {
        // Restore previously selected project (synchronous DB access - matches SetupDetector pattern)
        try {
            val savedProject = projectRepository.getSelectedProject()
            if (savedProject != null) {
                _uiState.value = ProjectUiState.ProjectsLoaded(
                    projects = emptyList(),
                    selectedProject = savedProject
                )
            }
        } catch (e: Exception) {
            // Log but don't crash - can recover on discovery
            _uiState.value = ProjectUiState.Idle
        }
    }

    fun discoverProjects(executor: RemoteExecutorContract? = null) {
        val exec = executor ?: connectedExecutor ?: remoteExecutor
            ?: run {
                _uiState.value = ProjectUiState.Error(
                    message = "No active SSH connection. Please connect first.",
                    isNotFoundError = false
                )
                return
            }
        connectedExecutor = exec

        discoveryJob?.cancel()
        discoveryJob = viewModelScope.launch {
            _uiState.value = ProjectUiState.Loading

            when (val result = projectRepository.discoverProjects(exec)) {
                is Result.Success -> {
                    val projects = result.data
                    if (projects.isEmpty()) {
                        _uiState.value = ProjectUiState.Error(
                            message = "No TinSu projects found on this remote PC.",
                            isNotFoundError = true
                        )
                    } else {
                        val currentSelected = projectRepository.getSelectedProject()
                        _uiState.value = ProjectUiState.ProjectsLoaded(
                            projects = projects,
                            selectedProject = currentSelected
                        )
                    }
                }
                is Result.Failure -> {
                    _uiState.value = ProjectUiState.Error(
                        message = result.error.userMessage,
                        isNotFoundError = false
                    )
                }
            }
        }
    }

    fun selectProject(project: ProjectInfo) {
        projectRepository.setSelectedProject(project)
        val currentState = _uiState.value
        if (currentState is ProjectUiState.ProjectsLoaded) {
            _uiState.value = currentState.copy(selectedProject = project)
        } else {
            _uiState.value = ProjectUiState.ProjectsLoaded(
                projects = emptyList(),
                selectedProject = project
            )
        }
    }

    fun refreshProjects() {
        val executor = connectedExecutor ?: run {
            _uiState.value = ProjectUiState.Error(
                message = "No active SSH connection. Please connect first.",
                isNotFoundError = false
            )
            return
        }
        discoverProjects(executor)
    }

    fun setConnectedExecutor(executor: RemoteExecutorContract) {
        connectedExecutor = executor
    }

    fun onCleared() {
        discoveryJob?.cancel()
    }
}
