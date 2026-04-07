package com.tinsu.mobile.db

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class ConnectionsTableTest {

    private fun createTestDb(): TinsuMobile {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        TinsuMobile.Schema.create(driver)
        return TinsuMobile(driver)
    }

    @Test
    fun insertAndQueryConnection() {
        val db = createTestDb()
        val now = 1712448000L

        db.connectionsQueries.insert(
            id = "conn-1",
            display_name = "My Dev Server",
            host = "192.168.1.100",
            port = 22,
            username = "dev",
            transport = "ssh",
            sort_order = 0,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        val result = db.connectionsQueries.selectById("conn-1").executeAsOneOrNull()
        assertNotNull(result)
        assertEquals("conn-1", result.id)
        assertEquals("My Dev Server", result.display_name)
        assertEquals("192.168.1.100", result.host)
        assertEquals(22, result.port)
        assertEquals("dev", result.username)
        assertEquals("ssh", result.transport)
        assertEquals(0, result.sort_order)
        assertNull(result.last_connected_at)
        assertEquals(now, result.created_at)
        assertEquals(now, result.updated_at)
    }

    @Test
    fun selectAllReturnsInsertedConnections() {
        val db = createTestDb()
        val now = 1712448000L

        db.connectionsQueries.insert(
            id = "conn-1",
            display_name = "Server A",
            host = "10.0.0.1",
            port = 22,
            username = "user1",
            transport = "ssh",
            sort_order = 0,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        db.connectionsQueries.insert(
            id = "conn-2",
            display_name = "Server B",
            host = "10.0.0.2",
            port = 2222,
            username = "user2",
            transport = "mosh",
            sort_order = 1,
            last_connected_at = now,
            created_at = now,
            updated_at = now
        )

        val results = db.connectionsQueries.selectAll().executeAsList()
        assertEquals(2, results.size)
    }

    @Test
    fun deleteByIdRemovesConnection() {
        val db = createTestDb()
        val now = 1712448000L

        db.connectionsQueries.insert(
            id = "conn-1",
            display_name = "To Delete",
            host = "10.0.0.1",
            port = 22,
            username = "user1",
            transport = "ssh",
            sort_order = 0,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        db.connectionsQueries.deleteById("conn-1")
        val result = db.connectionsQueries.selectById("conn-1").executeAsOneOrNull()
        assertNull(result)
    }

    @Test
    fun selectByIdReturnsNullForNonexistent() {
        val db = createTestDb()
        val result = db.connectionsQueries.selectById("nonexistent").executeAsOneOrNull()
        assertNull(result)
    }
}
