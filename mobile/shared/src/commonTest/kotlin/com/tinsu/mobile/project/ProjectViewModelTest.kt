package com.tinsu.mobile.project

import com.tinsu.mobile.connection.CommandResult
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.ConnectionConfig
import com.tinsu.mobile.connection.RemoteExecutorContract
import com.tinsu.mobile.connection.SessionInfo
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

class ProjectViewModelTest {

    private fun createViewModel(
        projectRepository: ProjectRepository = StubProjectRepository(),
        remoteExecutor: RemoteExecutorContract = StubRemoteExecutor(),
        connectionRepository: ConnectionRepository = StubConnectionRepo()
    ): ProjectViewModel {
        return ProjectViewModel(
            projectRepository = projectRepository,
            remoteExecutor = remoteExecutor,
            connectionRepository = connectionRepository
        )
    }

    // --- Initial state ---

    @Test
    fun initialState_isIdle() {
        val vm = createViewModel()
        assertTrue(vm.uiState.value is ProjectUiState.Idle)
    }

    @Test
    fun initialState_restoresSelectedProject() {
        val saved = ProjectInfo(name = "saved-app", path = "/home/user/saved-app")
        val vm = createViewModel(
            projectRepository = StubProjectRepository(selectedProject = saved)
        )
        val state = vm.uiState.value as ProjectUiState.ProjectsLoaded
        assertEquals(saved, state.selectedProject)
        assertTrue(state.projects.isEmpty())
    }

    // --- discoverProjects ---

    @Test
    fun discoverProjects_transitionsThroughLoadingToSuccess() = runTest {
        val projects = listOf(
            ProjectInfo(name = "app", path = "/home/user/app"),
            ProjectInfo(name = "other", path = "/home/user/other")
        )
        val vm = createViewModel(
            projectRepository = StubProjectRepository(discoveredProjects = projects)
        )
        vm.discoverProjects()
        kotlinx.coroutines.test.advanceUntilIdle()
        val state = vm.uiState.value as ProjectUiState.ProjectsLoaded
        assertEquals(2, state.projects.size)
        assertEquals("app", state.projects[0].name)
    }

    @Test
    fun discoverProjects_transitionsToErrorOnFailure() = runTest {
        val vm = createViewModel(
            projectRepository = StubProjectRepository(
                discoverError = AppError.ConnectionFailed("SSH error")
            )
        )
        vm.discoverProjects()
        kotlinx.coroutines.test.advanceUntilIdle()
        val state = vm.uiState.value as ProjectUiState.Error
        assertEquals("SSH error", state.message)
        assertEquals(false, state.isNotFoundError)
    }

    @Test
    fun discoverProjects_setsIsNotFoundErrorWhenEmptyProjects() = runTest {
        val vm = createViewModel(
            projectRepository = StubProjectRepository(discoveredProjects = emptyList())
        )
        vm.discoverProjects()
        kotlinx.coroutines.test.advanceUntilIdle()
        val state = vm.uiState.value as ProjectUiState.Error
        assertTrue(state.isNotFoundError)
    }

    // --- selectProject ---

    @Test
    fun selectProject_updatesState() {
        val vm = createViewModel()
        val project = ProjectInfo(name = "my-app", path = "/home/user/my-app")
        vm.selectProject(project)
        val state = vm.uiState.value as ProjectUiState.ProjectsLoaded
        assertEquals(project, state.selectedProject)
    }

    @Test
    fun selectProject_persistsSelection() {
        val repo = StubProjectRepository()
        val vm = createViewModel(projectRepository = repo)
        val project = ProjectInfo(name = "my-app", path = "/home/user/my-app")
        vm.selectProject(project)
        assertEquals(project, repo.lastSetProject)
    }

    @Test
    fun selectProject_preservesExistingProjectsList() {
        val projects = listOf(ProjectInfo(name = "app", path = "/home/user/app"))
        val vm = createViewModel(
            projectRepository = StubProjectRepository(discoveredProjects = projects)
        )
        // First discover to populate list
        vm.discoverProjects()
        kotlinx.coroutines.test.advanceUntilIdle()

        val selected = ProjectInfo(name = "app", path = "/home/user/app")
        vm.selectProject(selected)
        val state = vm.uiState.value as ProjectUiState.ProjectsLoaded
        assertEquals(1, state.projects.size)
        assertEquals(selected, state.selectedProject)
    }

    // --- refreshProjects ---

    @Test
    fun refreshProjects_rediscoversWithConnectedExecutor() = runTest {
        val executor = object : RemoteExecutorContract {
            override suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<SessionInfo> =
                Result.Success(SessionInfo("h", 22, "v", "u"))
            override suspend fun exec(command: String) = CommandResult(0, "/home/user/app/_bmad-output\n", "")
            override suspend fun disconnect() {}
            override fun isConnected() = true
        }
        val vm = createViewModel()
        // First discover to set connected executor
        vm.discoverProjects(executor)
        kotlinx.coroutines.test.advanceUntilIdle()

        vm.refreshProjects()
        kotlinx.coroutines.test.advanceUntilIdle()
        val state = vm.uiState.value as ProjectUiState.ProjectsLoaded
        assertEquals(1, state.projects.size)
    }

    @Test
    fun refreshProjects_doesNothingWithoutConnectedExecutor() {
        val vm = createViewModel()
        vm.refreshProjects()
        // Should still be Idle — no crash, no state change
        assertTrue(vm.uiState.value is ProjectUiState.Idle)
    }

    // --- setConnectedExecutor ---

    @Test
    fun setConnectedExecutor_storesExecutor() = runTest {
        val executor = object : RemoteExecutorContract {
            override suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<SessionInfo> =
                Result.Success(SessionInfo("h", 22, "v", "u"))
            override suspend fun exec(command: String) = CommandResult(0, "/home/user/app/_bmad-output\n", "")
            override suspend fun disconnect() {}
            override fun isConnected() = true
        }
        val vm = createViewModel()
        vm.setConnectedExecutor(executor)
        vm.refreshProjects()
        kotlinx.coroutines.test.advanceUntilIdle()
        val state = vm.uiState.value as ProjectUiState.ProjectsLoaded
        assertEquals("app", state.projects[0].name)
    }
}

// --- Fakes ---

private class StubProjectRepository(
    private val discoveredProjects: List<ProjectInfo> = emptyList(),
    private val selectedProject: ProjectInfo? = null,
    private val discoverError: AppError? = null
) : ProjectRepository {
    var lastSetProject: ProjectInfo? = null

    override suspend fun discoverProjects(remoteExecutor: RemoteExecutorContract): Result<List<ProjectInfo>> {
        return if (discoverError != null) {
            Result.Failure(discoverError)
        } else {
            Result.Success(discoveredProjects)
        }
    }

    override fun getSelectedProject(): ProjectInfo? = selectedProject
    override fun setSelectedProject(project: ProjectInfo) { lastSetProject = project }
    override fun clearSelectedProject() { lastSetProject = null }
}

private class StubRemoteExecutor : RemoteExecutorContract {
    override suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<SessionInfo> =
        Result.Success(SessionInfo(host, port, "OpenSSH", username))
    override suspend fun exec(command: String) = CommandResult(0, "", "")
    override suspend fun disconnect() {}
    override fun isConnected() = true
}

private class StubConnectionRepo : ConnectionRepository {
    override suspend fun getAllConnections(): Result<List<ConnectionConfig>> = Result.Success(emptyList())
    override suspend fun getConnectionById(id: String): Result<ConnectionConfig> = Result.Failure(AppError.ConnectionFailed("Not found"))
    override suspend fun createConnection(config: ConnectionConfig): Result<ConnectionConfig> = Result.Success(config)
    override suspend fun updateConnection(config: ConnectionConfig): Result<ConnectionConfig> = Result.Success(config)
    override suspend fun deleteConnection(id: String): Result<Unit> = Result.Success(Unit)
    override suspend fun reorderConnectionIds(ids: List<String>): Result<Unit> = Result.Success(Unit)
}
