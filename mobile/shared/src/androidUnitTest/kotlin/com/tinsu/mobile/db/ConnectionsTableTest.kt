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
            ssh_key_alias = null,
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
        assertNull(result.ssh_key_alias)
        assertEquals(now, result.created_at)
        assertEquals(now, result.updated_at)
    }

    @Test
    fun insertWithSshKeyAlias() {
        val db = createTestDb()
        val now = 1712448000L

        db.connectionsQueries.insert(
            id = "conn-1",
            display_name = "My Dev Server",
            host = "192.168.1.100",
            port = 22,
            username = "dev",
            transport = "ssh",
            ssh_key_alias = "my-ssh-key",
            sort_order = 0,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        val result = db.connectionsQueries.selectById("conn-1").executeAsOneOrNull()
        assertNotNull(result)
        assertEquals("my-ssh-key", result.ssh_key_alias)
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
            ssh_key_alias = null,
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
            ssh_key_alias = "key-b",
            sort_order = 1,
            last_connected_at = now,
            created_at = now,
            updated_at = now
        )

        val results = db.connectionsQueries.selectAll().executeAsList()
        assertEquals(2, results.size)
    }

    @Test
    fun selectAllSortedByOrder_ordersBySortOrder() {
        val db = createTestDb()
        val now = 1712448000L

        // Insert in reverse order
        db.connectionsQueries.insert(
            id = "conn-1",
            display_name = "First",
            host = "host1.com",
            port = 22,
            username = "user",
            transport = "ssh",
            ssh_key_alias = null,
            sort_order = 2,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        db.connectionsQueries.insert(
            id = "conn-2",
            display_name = "Second",
            host = "host2.com",
            port = 22,
            username = "user",
            transport = "ssh",
            ssh_key_alias = null,
            sort_order = 0,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        db.connectionsQueries.insert(
            id = "conn-3",
            display_name = "Third",
            host = "host3.com",
            port = 22,
            username = "user",
            transport = "ssh",
            ssh_key_alias = null,
            sort_order = 1,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        val results = db.connectionsQueries.selectAllSortedByOrder().executeAsList()
        assertEquals(3, results.size)
        assertEquals("Second", results[0].display_name)
        assertEquals("Third", results[1].display_name)
        assertEquals("First", results[2].display_name)
    }

    @Test
    fun updateConnection() {
        val db = createTestDb()
        val now = 1712448000L
        val later = now + 1000

        db.connectionsQueries.insert(
            id = "conn-1",
            display_name = "Original Name",
            host = "original.com",
            port = 22,
            username = "user",
            transport = "ssh",
            ssh_key_alias = null,
            sort_order = 0,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        db.connectionsQueries.update(
            display_name = "Updated Name",
            host = "updated.com",
            port = 2222,
            username = "admin",
            transport = "mosh",
            ssh_key_alias = "new-key",
            sort_order = 5,
            last_connected_at = later,
            updated_at = later,
            id = "conn-1"
        )

        val result = db.connectionsQueries.selectById("conn-1").executeAsOneOrNull()
        assertNotNull(result)
        assertEquals("Updated Name", result.display_name)
        assertEquals("updated.com", result.host)
        assertEquals(2222, result.port)
        assertEquals("admin", result.username)
        assertEquals("mosh", result.transport)
        assertEquals("new-key", result.ssh_key_alias)
        assertEquals(5, result.sort_order)
        assertEquals(later, result.last_connected_at)
        assertEquals(later, result.updated_at)
    }

    @Test
    fun updateSortOrder() {
        val db = createTestDb()
        val now = 1712448000L
        val later = now + 1000

        db.connectionsQueries.insert(
            id = "conn-1",
            display_name = "Test",
            host = "test.com",
            port = 22,
            username = "user",
            transport = "ssh",
            ssh_key_alias = null,
            sort_order = 0,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        db.connectionsQueries.updateSortOrder(
            sort_order = 10,
            updated_at = later,
            id = "conn-1"
        )

        val result = db.connectionsQueries.selectById("conn-1").executeAsOneOrNull()
        assertNotNull(result)
        assertEquals(10, result.sort_order)
        assertEquals(later, result.updated_at)
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
            ssh_key_alias = null,
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

    @Test
    fun moshTransportType() {
        val db = createTestDb()
        val now = 1712448000L

        db.connectionsQueries.insert(
            id = "conn-1",
            display_name = "Mosh Server",
            host = "mosh.com",
            port = 22,
            username = "user",
            transport = "mosh",
            ssh_key_alias = null,
            sort_order = 0,
            last_connected_at = null,
            created_at = now,
            updated_at = now
        )

        val result = db.connectionsQueries.selectById("conn-1").executeAsOneOrNull()
        assertNotNull(result)
        assertEquals("mosh", result.transport)
    }
}
