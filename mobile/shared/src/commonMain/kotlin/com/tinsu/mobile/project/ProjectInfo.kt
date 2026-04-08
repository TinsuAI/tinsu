package com.tinsu.mobile.project

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Data model representing a discovered TinSu project on a remote PC.
 *
 * @param name Project directory name (e.g. "my-app")
 * @param path Full path to the project root (e.g. "/home/user/projects/my-app")
 * @param activeSessionCount Currently running tmux sessions matching `tinsu-{name}-*`
 */
@Serializable
data class ProjectInfo(
    val name: String,
    val path: String,
    val activeSessionCount: Int = 0
) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun fromJson(jsonString: String): ProjectInfo = json.decodeFromString(serializer(), jsonString)

        fun toJson(project: ProjectInfo): String = json.encodeToString(serializer(), project)
    }
}
