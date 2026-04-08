package com.tinsu.mobile.connection

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ConnectionEventTest {

    @Test
    fun `Connected event contains correct data`() {
        val event = ConnectionEvent.Connected(
            host = "192.168.1.100",
            port = 22,
            transport = TransportType.SSH,
            uptime = 3600000L // 1 hour
        )

        assertTrue(event is ConnectionEvent.Connected)
        assertEquals("192.168.1.100", event.host)
        assertEquals(22, event.port)
        assertEquals(TransportType.SSH, event.transport)
        assertEquals(3600000L, event.uptime)
    }

    @Test
    fun `Reconnecting event is singleton`() {
        val event1 = ConnectionEvent.Reconnecting
        val event2 = ConnectionEvent.Reconnecting

        assertTrue(event1 is ConnectionEvent.Reconnecting)
        assertTrue(event2 is ConnectionEvent.Reconnecting)
        assertEquals(event1, event2)
    }

    @Test
    fun `Disconnected event can have optional reason`() {
        val eventWithReason = ConnectionEvent.Disconnected("Connection timeout")
        val eventWithoutReason = ConnectionEvent.Disconnected(null)

        assertTrue(eventWithReason is ConnectionEvent.Disconnected)
        assertEquals("Connection timeout", eventWithReason.reason)
        assertNull(eventWithoutReason.reason)
    }

    @Test
    fun `Offline event is singleton`() {
        val event1 = ConnectionEvent.Offline
        val event2 = ConnectionEvent.Offline

        assertTrue(event1 is ConnectionEvent.Offline)
        assertTrue(event2 is ConnectionEvent.Offline)
        assertEquals(event1, event2)
    }

    @Test
    fun `Connected event supports MOSH transport`() {
        val event = ConnectionEvent.Connected(
            host = "example.com",
            port = 60001,
            transport = TransportType.MOSH,
            uptime = 0L
        )

        assertTrue(event is ConnectionEvent.Connected)
        assertEquals(TransportType.MOSH, event.transport)
    }

    @Test
    fun `TransportType enum has correct display names`() {
        assertEquals("SSH", TransportType.SSH.displayName)
        assertEquals("mosh", TransportType.MOSH.displayName)
    }

    @Test
    fun `TransportType fromDbValue handles all cases`() {
        assertEquals(TransportType.SSH, TransportType.fromDbValue("ssh"))
        assertEquals(TransportType.MOSH, TransportType.fromDbValue("mosh"))
        assertEquals(TransportType.SSH, TransportType.fromDbValue("SSH")) // Case insensitive
        assertEquals(TransportType.SSH, TransportType.fromDbValue(null)) // Default
        assertEquals(TransportType.SSH, TransportType.fromDbValue("invalid")) // Default fallback
    }

    @Test
    fun `TransportType toDbValue converts correctly`() {
        assertEquals("ssh", TransportType.SSH.toDbValue())
        assertEquals("mosh", TransportType.MOSH.toDbValue())
    }
}
