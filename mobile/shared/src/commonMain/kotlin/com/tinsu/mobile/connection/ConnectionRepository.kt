package com.tinsu.mobile.connection

import com.tinsu.mobile.util.Result

/**
 * Repository interface for managing remote PC connections.
 * Implemented separately for Android and iOS platforms.
 */
interface ConnectionRepository {
    /**
     * Retrieves all connections, sorted by sort_order ASC, then created_at DESC.
     */
    suspend fun getAllConnections(): Result<List<ConnectionConfig>>

    /**
     * Retrieves a single connection by its ID.
     */
    suspend fun getConnectionById(id: String): Result<ConnectionConfig>

    /**
     * Creates a new connection with a generated UUID and sets timestamps.
     */
    suspend fun createConnection(config: ConnectionConfig): Result<ConnectionConfig>

    /**
     * Updates an existing connection, refreshing the updated_at timestamp.
     */
    suspend fun updateConnection(config: ConnectionConfig): Result<ConnectionConfig>

    /**
     * Deletes a connection by its ID.
     */
    suspend fun deleteConnection(id: String): Result<Unit>

    /**
     * Reorders connections by updating their sort_order values.
     * The IDs list represents the new order (first = highest priority).
     */
    suspend fun reorderConnectionIds(ids: List<String>): Result<Unit>
}
