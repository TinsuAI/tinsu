package com.tinsu.mobile.connection

import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Android implementation of ConnectionRepository using SQLDelight.
 */
actual fun createConnectionRepository(database: TinsuMobile): ConnectionRepository {
    return AndroidConnectionRepository(database)
}

private class AndroidConnectionRepository(
    private val database: TinsuMobile
) : ConnectionRepository {

    override suspend fun getAllConnections(): Result<List<ConnectionConfig>> = withContext(Dispatchers.IO) {
        try {
            val connections = database.connectionsQueries.selectAllSortedByOrder(
                mapper = { id, display_name, host, port, username, transport, ssh_key_alias, sort_order, last_connected_at, created_at, updated_at ->
                    ConnectionConfig(
                        id = id,
                        displayName = display_name,
                        host = host,
                        port = port.toInt(),
                        username = username,
                        transportType = TransportType.fromDbValue(transport),
                        sshKeyAlias = ssh_key_alias,
                        sortOrder = sort_order.toInt(),
                        lastConnectedAt = last_connected_at,
                        createdAt = created_at,
                        updatedAt = updated_at
                    )
                }
            ).executeAsList()
            Result.Success(connections)
        } catch (e: Exception) {
            Result.Failure(AppError.DatabaseError(e.message ?: "Unknown error"))
        }
    }

    override suspend fun getConnectionById(id: String): Result<ConnectionConfig> = withContext(Dispatchers.IO) {
        try {
            val connection = database.connectionsQueries.selectById(id) { _, display_name, host, port, username, transport, ssh_key_alias, sort_order, last_connected_at, created_at, updated_at ->
                ConnectionConfig(
                    id = id,
                    displayName = display_name,
                    host = host,
                    port = port.toInt(),
                    username = username,
                    transportType = TransportType.fromDbValue(transport),
                    sshKeyAlias = ssh_key_alias,
                    sortOrder = sort_order.toInt(),
                    lastConnectedAt = last_connected_at,
                    createdAt = created_at,
                    updatedAt = updated_at
                )
            }.executeAsOneOrNull()

            if (connection != null) {
                Result.Success(connection)
            } else {
                Result.Failure(AppError.ConnectionNotFound(id))
            }
        } catch (e: Exception) {
            Result.Failure(AppError.DatabaseError(e.message ?: "Unknown error"))
        }
    }

    override suspend fun createConnection(config: ConnectionConfig): Result<ConnectionConfig> = withContext(Dispatchers.IO) {
        try {
            // Validate before inserting
            val validationResult = config.isValid()
            if (validationResult is Result.Failure) {
                return@withContext validationResult
            }

            val newId = UUID.randomUUID().toString()
            val now = System.currentTimeMillis()
            val configForInsert = config.copy(
                id = newId,
                createdAt = now,
                updatedAt = now
            )

            database.connectionsQueries.insert(
                id = configForInsert.id!!,
                display_name = configForInsert.displayName,
                host = configForInsert.host,
                port = configForInsert.port.toLong(),
                username = configForInsert.username,
                transport = configForInsert.transportType.toDbValue(),
                ssh_key_alias = configForInsert.sshKeyAlias,
                sort_order = configForInsert.sortOrder.toLong(),
                last_connected_at = configForInsert.lastConnectedAt,
                created_at = configForInsert.createdAt,
                updated_at = configForInsert.updatedAt
            )

            Result.Success(configForInsert)
        } catch (e: Exception) {
            Result.Failure(AppError.DatabaseError(e.message ?: "Unknown error"))
        }
    }

    override suspend fun updateConnection(config: ConnectionConfig): Result<ConnectionConfig> = withContext(Dispatchers.IO) {
        try {
            if (config.id == null) {
                return@withContext Result.Failure(AppError.InvalidConnectionDetails("Cannot update connection without ID"))
            }

            // Validate before updating
            val validationResult = config.isValid()
            if (validationResult is Result.Failure) {
                return@withContext validationResult
            }

            // Check if connection exists
            val exists = database.connectionsQueries.selectById(config.id) { _, _, _, _, _, _, _, _, _, _, _ -> true }.executeAsOneOrNull() != null
            if (!exists) {
                return@withContext Result.Failure(AppError.ConnectionNotFound(config.id))
            }

            val now = System.currentTimeMillis()
            val configForUpdate = config.copy(updatedAt = now)

            database.connectionsQueries.update(
                display_name = configForUpdate.displayName,
                host = configForUpdate.host,
                port = configForUpdate.port.toLong(),
                username = configForUpdate.username,
                transport = configForUpdate.transportType.toDbValue(),
                ssh_key_alias = configForUpdate.sshKeyAlias,
                sort_order = configForUpdate.sortOrder.toLong(),
                last_connected_at = configForUpdate.lastConnectedAt,
                updated_at = configForUpdate.updatedAt,
                id = config.id!!
            )

            Result.Success(configForUpdate)
        } catch (e: Exception) {
            Result.Failure(AppError.DatabaseError(e.message ?: "Unknown error"))
        }
    }

    override suspend fun deleteConnection(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            database.connectionsQueries.deleteById(id)
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Failure(AppError.DatabaseError(e.message ?: "Unknown error"))
        }
    }

    override suspend fun reorderConnectionIds(ids: List<String>): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val now = System.currentTimeMillis()
            database.transaction {
                ids.forEachIndexed { index, id ->
                    database.connectionsQueries.updateSortOrder(
                        sort_order = index.toLong(),
                        updated_at = now,
                        id = id
                    )
                }
            }
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Failure(AppError.DatabaseError(e.message ?: "Unknown error"))
        }
    }
}
