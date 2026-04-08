package com.tinsu.mobile.connection

import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.util.Result
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Tests for ConnectionRepository functionality.
 * Note: Full integration tests require platform-specific test setup.
 * These tests verify the data model and validation logic.
 */
class ConnectionRepositoryTest {

    @Test
    fun test_connectionConfig_validation_required_fields() {
        // Missing display name
        val invalid1 = ConnectionConfig(
            displayName = "",
            host = "example.com",
            username = "user"
        )
        val result1 = invalid1.isValid()
        assertTrue(result1 is Result.Failure, "Should fail with empty display name")

        // Missing host
        val invalid2 = ConnectionConfig(
            displayName = "Test",
            host = "",
            username = "user"
        )
        val result2 = invalid2.isValid()
        assertTrue(result2 is Result.Failure, "Should fail with empty host")

        // Missing username
        val invalid3 = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = ""
        )
        val result3 = invalid3.isValid()
        assertTrue(result3 is Result.Failure, "Should fail with empty username")

        // Invalid port
        val invalid4 = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            port = 0
        )
        val result4 = invalid4.isValid()
        assertTrue(result4 is Result.Failure, "Should fail with invalid port")

        // Invalid port (too high)
        val invalid5 = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            port = 70000
        )
        val result5 = invalid5.isValid()
        assertTrue(result5 is Result.Failure, "Should fail with port > 65535")
    }

    @Test
    fun test_connectionConfig_validation_succeeds() {
        val valid = ConnectionConfig(
            displayName = "Test Connection",
            host = "example.com",
            port = 22,
            username = "user",
            transportType = TransportType.SSH,
            sshKeyAlias = "my-key"
        )
        val result = valid.isValid()
        assertTrue(result is Result.Success, "Should pass validation with valid fields")
    }

    @Test
    fun test_connectionConfig_forInsert_generates_id() {
        val config = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user"
        )
        val withId = config.forInsert("new-id")
        assertEquals("new-id", withId.id)
        assertNotNull(withId.createdAt)
        assertNotNull(withId.updatedAt)
    }

    @Test
    fun test_connectionConfig_forUpdate_updates_timestamp() {
        val config = ConnectionConfig(
            id = "test-id",
            displayName = "Test",
            host = "example.com",
            username = "user",
            createdAt = 1000,
            updatedAt = 1000
        )
        val updated = config.forUpdate()
        assertEquals("test-id", updated.id)
        assertEquals("Test", updated.displayName)
        assertTrue(updated.updatedAt > 1000, "updatedAt should be refreshed")
    }

    @Test
    fun test_transportType_toDbValue() {
        assertEquals("ssh", TransportType.SSH.toDbValue())
        assertEquals("mosh", TransportType.MOSH.toDbValue())
    }

    @Test
    fun test_transportType_fromDbValue() {
        assertEquals(TransportType.SSH, TransportType.fromDbValue("ssh"))
        assertEquals(TransportType.MOSH, TransportType.fromDbValue("mosh"))
    }

    @Test
    fun test_connectionConfig_with_ssh_key_alias() {
        val withKey = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = "my-key"
        )
        assertEquals("my-key", withKey.sshKeyAlias)
    }

    @Test
    fun test_connectionConfig_with_null_ssh_key_alias() {
        val withoutKey = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = "user",
            sshKeyAlias = null
        )
        assertNull(withoutKey.sshKeyAlias)
    }

    @Test
    fun test_connectionConfig_validation_display_name_too_long() {
        val tooLong = "a".repeat(51)
        val invalid = ConnectionConfig(
            displayName = tooLong,
            host = "example.com",
            username = "user"
        )
        val result = invalid.isValid()
        assertTrue(result is Result.Failure, "Should fail with display name > 50 chars")
    }

    @Test
    fun test_connectionConfig_validation_host_too_long() {
        val tooLong = "a".repeat(256)
        val invalid = ConnectionConfig(
            displayName = "Test",
            host = tooLong,
            username = "user"
        )
        val result = invalid.isValid()
        assertTrue(result is Result.Failure, "Should fail with host > 255 chars")
    }

    @Test
    fun test_connectionConfig_validation_username_too_long() {
        val tooLong = "a".repeat(101)
        val invalid = ConnectionConfig(
            displayName = "Test",
            host = "example.com",
            username = tooLong
        )
        val result = invalid.isValid()
        assertTrue(result is Result.Failure, "Should fail with username > 100 chars")
    }

    @Test
    fun test_connectionConfig_trimmed_validation() {
        val withSpaces = ConnectionConfig(
            displayName = "  Valid Name  ",
            host = "  example.com  ",
            username = "  user  "
        )
        val result = withSpaces.isValid()
        assertTrue(result is Result.Success, "Should pass validation - trim is checked in isValid()")
    }
}
