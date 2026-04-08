package com.tinsu.mobile.connection

import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlinx.datetime.Clock

/**
 * Data model representing a remote PC connection configuration.
 */
data class ConnectionConfig(
    val id: String? = null,
    val displayName: String,
    val host: String,
    val port: Int = 22,
    val username: String,
    val transportType: TransportType = TransportType.SSH,
    val sshKeyAlias: String? = null,
    val sortOrder: Int = 0,
    val lastConnectedAt: Long? = null,
    val createdAt: Long = Clock.System.now().toEpochMilliseconds(),
    val updatedAt: Long = Clock.System.now().toEpochMilliseconds()
) {
    /**
     * Validates the connection configuration.
     * Returns Result.Success if valid, Result.Failure with details if invalid.
     */
    fun isValid(): Result<Unit> {
        val trimmedDisplayName = displayName.trim()
        if (trimmedDisplayName.isEmpty()) {
            return Result.Failure(AppError.InvalidConnectionDetails("Display name is required"))
        }
        if (trimmedDisplayName.length > 50) {
            return Result.Failure(AppError.InvalidConnectionDetails("Display name must be 50 characters or less"))
        }

        val trimmedHost = host.trim()
        if (trimmedHost.isEmpty()) {
            return Result.Failure(AppError.InvalidConnectionDetails("Host is required"))
        }
        if (trimmedHost.length > 255) {
            return Result.Failure(AppError.InvalidConnectionDetails("Host must be 255 characters or less"))
        }

        val trimmedUsername = username.trim()
        if (trimmedUsername.isEmpty()) {
            return Result.Failure(AppError.InvalidConnectionDetails("Username is required"))
        }
        if (trimmedUsername.length > 100) {
            return Result.Failure(AppError.InvalidConnectionDetails("Username must be 100 characters or less"))
        }

        if (port < 1 || port > 65535) {
            return Result.Failure(AppError.InvalidConnectionDetails("Port must be between 1 and 65535"))
        }

        return Result.Success(Unit)
    }

    /**
     * Returns a copy of this config with the ID set and timestamps updated for new connections.
     */
    fun forInsert(newId: String): ConnectionConfig = copy(
        id = newId,
        createdAt = Clock.System.now().toEpochMilliseconds(),
        updatedAt = Clock.System.now().toEpochMilliseconds()
    )

    /**
     * Returns a copy of this config with the updated_at timestamp refreshed for updates.
     */
    fun forUpdate(): ConnectionConfig = copy(
        updatedAt = Clock.System.now().toEpochMilliseconds()
    )
}
