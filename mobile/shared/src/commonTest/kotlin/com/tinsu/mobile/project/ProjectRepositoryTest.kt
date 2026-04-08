package com.tinsu.mobile.project

import com.tinsu.mobile.connection.CommandResult
import com.tinsu.mobile.connection.RemoteExecutorContract
import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.util.Result
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.db.SqlPreparedStatement
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProjectRepositoryTest {

    // --- parseProjectPaths ---

    @Test
    fun parseProjectPaths_parsesFindOutput() {
        val impl = TestableProjectRepository()
        val output = """
            /home/user/projects/my-app/_bmad-output
            /home/user/code/other-project/_bmad-output
        """.trimIndent()
        val projects = impl.testParseProjectPaths(output)
        assertEquals(2, projects.size)
        assertEquals("my-app", projects[0].name)
        assertEquals("/home/user/projects/my-app", projects[0].path)
        assertEquals("other-project", projects[1].name)
        assertEquals("/home/user/code/other-project", projects[1].path)
    }

    @Test
    fun parseProjectPaths_deduplicatesByPath() {
        val impl = TestableProjectRepository()
        val output = """
            /home/user/projects/app/_bmad-output
            /home/user/projects/app/_bmad-output
        """.trimIndent()
        val projects = impl.testParseProjectPaths(output)
        assertEquals(1, projects.size)
    }

    @Test
    fun parseProjectPaths_returnsEmptyForBlankOutput() {
        val impl = TestableProjectRepository()
        val projects = impl.testParseProjectPaths("")
        assertTrue(projects.isEmpty())
    }

    @Test
    fun parseProjectPaths_handlesNestedPaths() {
        val impl = TestableProjectRepository()
        val output = "/home/user/work/client/project-a/_bmad-output\n"
        val projects = impl.testParseProjectPaths(output)
        assertEquals(1, projects.size)
        assertEquals("project-a", projects[0].name)
        assertEquals("/home/user/work/client/project-a", projects[0].path)
    }

    @Test
    fun parseProjectPaths_ignoresBlankLines() {
        val impl = TestableProjectRepository()
        val output = "\n\n/home/user/projects/app/_bmad-output\n\n"
        val projects = impl.testParseProjectPaths(output)
        assertEquals(1, projects.size)
    }

    // --- discoverProjects ---

    @Test
    fun discoverProjects_returnsProjectsFromFindCommand() = kotlinx.coroutines.test.runTest {
        val executor = StubExecutor(
            findResult = CommandResult(0, "/home/user/projects/app/_bmad-output\n", ""),
            tmuxResult = CommandResult(1, "", "")
        )
        val repo = TestableProjectRepository()
        val result = repo.discoverProjects(executor)
        assertTrue(result is Result.Success)
        assertEquals(1, result.data.size)
        assertEquals("app", result.data[0].name)
    }

    @Test
    fun discoverProjects_returnsEmptyWhenNoProjectsFound() = kotlinx.coroutines.test.runTest {
        val executor = StubExecutor(
            findResult = CommandResult(0, "", ""),
            tmuxResult = CommandResult(1, "", "")
        )
        val repo = TestableProjectRepository()
        val result = repo.discoverProjects(executor)
        assertTrue(result is Result.Success)
        assertTrue(result.data.isEmpty())
    }

    @Test
    fun discoverProjects_returnsEmptyOnNonZeroExitWithBlankStdout() = kotlinx.coroutines.test.runTest {
        val executor = StubExecutor(
            findResult = CommandResult(1, "", "permission denied"),
            tmuxResult = CommandResult(1, "", "")
        )
        val repo = TestableProjectRepository()
        val result = repo.discoverProjects(executor)
        assertTrue(result is Result.Success)
        assertTrue(result.data.isEmpty())
    }

    @Test
    fun discoverProjects_countsActiveSessionsFromTmux() = kotlinx.coroutines.test.runTest {
        val executor = StubExecutor(
            findResult = CommandResult(0, "/home/user/projects/app/_bmad-output\n", ""),
            tmuxResult = CommandResult(
                0,
                "tinsu-app-task-1\ntinsu-app-task-2\nother-session\ntinsu-other-task-1\n",
                ""
            )
        )
        val repo = TestableProjectRepository()
        val result = repo.discoverProjects(executor)
        assertTrue(result is Result.Success)
        val appProject = result.data.first { it.name == "app" }
        assertEquals(2, appProject.activeSessionCount)
    }

    @Test
    fun discoverProjects_sortsProjectsAlphabetically() = kotlinx.coroutines.test.runTest {
        val executor = StubExecutor(
            findResult = CommandResult(
                0,
                "/home/user/projects/zebra/_bmad-output\n/home/user/projects/alpha/_bmad-output\n",
                ""
            ),
            tmuxResult = CommandResult(1, "", "")
        )
        val repo = TestableProjectRepository()
        val result = repo.discoverProjects(executor)
        assertTrue(result is Result.Success)
        assertEquals("alpha", result.data[0].name)
        assertEquals("zebra", result.data[1].name)
    }

    @Test
    fun discoverProjects_handlesExecutorException() = kotlinx.coroutines.test.runTest {
        val executor = object : RemoteExecutorContract {
            override suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<com.tinsu.mobile.connection.SessionInfo> =
                Result.Success(com.tinsu.mobile.connection.SessionInfo("h", 22, "v", "u"))
            override suspend fun exec(command: String): CommandResult =
                throw RuntimeException("Connection lost")
            override suspend fun disconnect() {}
            override fun isConnected() = false
        }
        val repo = TestableProjectRepository()
        val result = repo.discoverProjects(executor)
        assertTrue(result is Result.Failure)
    }

    @Test
    fun discoverProjects_completesWithin10SecondsFor20Projects() = kotlinx.coroutines.test.runTest {
        // Simulate 20 projects - AC #4 requires <10s discovery (NFR10)
        val projectPaths = buildString {
            for (i in 1..20) {
                append("/home/user/projects/project-${i}/_bmad-output\n")
            }
        }
        val executor = StubExecutor(
            findResult = CommandResult(0, projectPaths, ""),
            tmuxResult = CommandResult(1, "", "")
        )
        val repo = TestableProjectRepository()
        val startTime = System.currentTimeMillis()
        val result = repo.discoverProjects(executor)
        val duration = System.currentTimeMillis() - startTime

        assertTrue(result is Result.Success)
        assertEquals(20, result.data.size)
        assertTrue(duration < 10_000, "Discovery should complete within 10 seconds but took ${duration}ms")
    }
}

// --- Fakes ---

private class StubExecutor(
    private val findResult: CommandResult,
    private val tmuxResult: CommandResult
) : RemoteExecutorContract {
    override suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<com.tinsu.mobile.connection.SessionInfo> =
        Result.Success(com.tinsu.mobile.connection.SessionInfo(host, port, "OpenSSH", username))
    override suspend fun exec(command: String): CommandResult {
        return if (command.contains("find")) findResult else tmuxResult
    }
    override suspend fun disconnect() {}
    override fun isConnected() = true
}

/**
 * Testable subclass that stubs out the database dependency.
 */
private class TestableProjectRepository : ProjectRepositoryImpl(
    database = object : TinsuMobile(
        driver = object : SqlDriver {
            override fun executeQuery(identifier: Int?, sql: String, parameters: Int, binders: (SqlPreparedStatement.() -> Unit)?): app.cash.sqldelight.db.QueryResult.Value<Long> =
                app.cash.sqldelight.db.QueryResult.Value(0)
            override fun execute(identifier: Int?, sql: String, parameters: Int, binders: (SqlPreparedStatement.() -> Unit)?): app.cash.sqldelight.db.QueryResult.Value<Long> =
                app.cash.sqldelight.db.QueryResult.Value(0)
            override fun addListener(listener: SqlDriver.Listener, queryKeys: Array<String>) {}
            override fun removeListener(listener: SqlDriver.Listener, queryKeys: Array<String>) {}
            override fun notifyListeners(queryKeys: Array<String>) {}
            override fun close() {}
        }
    ) {}
) {
    fun testParseProjectPaths(output: String): List<ProjectInfo> = parseProjectPaths(output)

    // Override persistence methods to avoid DB in tests
    private var savedProject: ProjectInfo? = null

    override fun getSelectedProject(): ProjectInfo? = savedProject
    override fun setSelectedProject(project: ProjectInfo) { savedProject = project }
    override fun clearSelectedProject() { savedProject = null }
}
