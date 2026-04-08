package com.tinsu.mobile.project

import com.tinsu.mobile.connection.CommandResult
import com.tinsu.mobile.connection.RemoteExecutorContract
import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.datetime.Clock

interface ProjectRepository {
    suspend fun discoverProjects(remoteExecutor: RemoteExecutorContract): Result<List<ProjectInfo>>
    fun getSelectedProject(): ProjectInfo?
    fun setSelectedProject(project: ProjectInfo)
    fun clearSelectedProject()
}

class ProjectRepositoryImpl(
    private val database: TinsuMobile
) : ProjectRepository {

    override suspend fun discoverProjects(remoteExecutor: RemoteExecutorContract): Result<List<ProjectInfo>> =
        withContext(Dispatchers.IO) {
            try {
                withTimeout(DISCOVERY_TIMEOUT_MS) {
                    val findResult = remoteExecutor.exec(FIND_COMMAND)
                    // Accept output with non-zero exit if stdout has content (e.g., permission denied warnings suppressed)
                    if (findResult.exitCode != 0 && findResult.stdout.isBlank()) {
                        return@withContext Result.Success(emptyList())
                    }

                    val projects = parseProjectPaths(findResult.stdout)
                    if (projects.isEmpty()) {
                        return@withContext Result.Success(emptyList())
                    }

                    // Enrich with active session counts
                    val enrichedProjects = enrichWithSessionCounts(remoteExecutor, projects)
                    Result.Success(enrichedProjects.sortedBy { it.name.lowercase() })
                }
            } catch (_: kotlinx.coroutines.TimeoutCancellationException) {
                Result.Failure(AppError.Timeout("Project discovery"))
            } catch (e: Exception) {
                Result.Failure(AppError.ConnectionFailed(e.message ?: "Discovery failed"))
            }
        }

    override fun getSelectedProject(): ProjectInfo? {
        val row = database.appPreferencesQueries.selectByKey(SELECTED_PROJECT_KEY).executeAsOneOrNull()
            ?: return null
        return try {
            ProjectInfo.fromJson(row.value)
        } catch (e: Exception) {
            // Corrupt preference data - clear it to prevent repeated failures
            database.appPreferencesQueries.deleteByKey(SELECTED_PROJECT_KEY)
            null
        }
    }

    override fun setSelectedProject(project: ProjectInfo) {
        val now = Clock.System.now().toEpochMilliseconds()
        database.appPreferencesQueries.insert(SELECTED_PROJECT_KEY, ProjectInfo.toJson(project), now)
    }

    override fun clearSelectedProject() {
        database.appPreferencesQueries.deleteByKey(SELECTED_PROJECT_KEY)
    }

    internal fun parseProjectPaths(output: String): List<ProjectInfo> {
        return output.lineSequence()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .mapNotNull { path ->
                // Normalize: remove trailing slash before extracting parent
                val normalizedPath = path.trimEnd('/')
                // Parent of _bmad-output is the project root
                val projectPath = normalizedPath.substringBeforeLast("/")
                val name = projectPath.substringAfterLast("/")
                if (name.isNotBlank()) ProjectInfo(name = name, path = projectPath) else null
            }
            .distinctBy { it.path }
    }

    private fun enrichWithSessionCounts(
        remoteExecutor: RemoteExecutorContract,
        projects: List<ProjectInfo>
    ): List<ProjectInfo> {
        val tmuxResult = remoteExecutor.exec(TMUX_LIST_SESSIONS)
        if (tmuxResult.exitCode != 0) return projects

        // Validate session names: must match tinsu-{project}-{task} format
        val sessionPattern = Regex("^${Regex.escape(TINSU_SESSION_PREFIX)}[^-]+-[^-]+$")
        val sessions = tmuxResult.stdout.lineSequence()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .filter { session -> sessionPattern.matches(session) }
            .toMutableList()

        // Match longest project names first to prevent prefix collisions
        // (e.g., "app-backend" sessions matching "app" prefix)
        return projects.sortedByDescending { it.name.length }.map { project ->
            val prefix = "${TINSU_SESSION_PREFIX}${project.name}-"
            val matching = sessions.filter { it.startsWith(prefix) }
            sessions.removeAll(matching.toSet())
            project.copy(activeSessionCount = matching.size)
        }
    }

    companion object {
        internal const val SELECTED_PROJECT_KEY = "selected_project"
        internal const val DISCOVERY_TIMEOUT_MS = 10_000L
        internal const val FIND_COMMAND = "find ~ -maxdepth 4 -name \"_bmad-output\" -type d 2>/dev/null"
        internal const val TMUX_LIST_SESSIONS = "tmux list-sessions -F '#{session_name}' 2>/dev/null"
        internal const val TINSU_SESSION_PREFIX = "tinsu-"
    }
}
