package com.tinsu.mobile.util

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ResultTest {

    @Test
    fun successWrapsDataCorrectly() {
        val result: Result<String> = Result.Success("hello")
        assertIs<Result.Success<String>>(result)
        assertEquals("hello", result.data)
    }

    @Test
    fun successIsSuccessReturnsTrue() {
        val result: Result<Int> = Result.Success(42)
        assertTrue(result.isSuccess)
    }

    @Test
    fun failureWrapsAppErrorCorrectly() {
        val error = AppError.ConnectionFailed("no wifi")
        val result: Result<String> = Result.Failure(error)
        assertIs<Result.Failure>(result)
        assertEquals(error, result.error)
    }

    @Test
    fun failureIsSuccessReturnsFalse() {
        val result: Result<String> = Result.Failure(AppError.Timeout("fetch"))
        assertFalse(result.isSuccess)
    }

    @Test
    fun getOrNullReturnsDataForSuccess() {
        val result: Result<String> = Result.Success("data")
        assertEquals("data", result.getOrNull())
    }

    @Test
    fun getOrNullReturnsNullForFailure() {
        val result: Result<String> = Result.Failure(AppError.SyncFailed("conflict"))
        assertNull(result.getOrNull())
    }

    @Test
    fun getOrElseReturnsDataForSuccess() {
        val result: Result<String> = Result.Success("value")
        assertEquals("value", result.getOrElse("default"))
    }

    @Test
    fun getOrElseReturnsDefaultForFailure() {
        val result: Result<String> = Result.Failure(AppError.ConnectionFailed("down"))
        assertEquals("default", result.getOrElse("default"))
    }

    @Test
    fun mapTransformsSuccessData() {
        val result: Result<Int> = Result.Success(5)
        val mapped = result.map { it * 2 }
        assertIs<Result.Success<Int>>(mapped)
        assertEquals(10, mapped.data)
    }

    @Test
    fun mapPassesFailureThroughUnchanged() {
        val error = AppError.Timeout("op")
        val result: Result<Int> = Result.Failure(error)
        val mapped = result.map { it * 2 }
        assertIs<Result.Failure>(mapped)
        assertEquals(error, mapped.error)
    }

    @Test
    fun flatMapChainsSuccessOperations() {
        val result: Result<Int> = Result.Success(10)
        val chained = result.flatMap { Result.Success(it.toString()) }
        assertIs<Result.Success<String>>(chained)
        assertEquals("10", chained.data)
    }

    @Test
    fun flatMapReturnsFailureFromOriginal() {
        val error = AppError.SyncFailed("reason")
        val result: Result<Int> = Result.Failure(error)
        val chained = result.flatMap { Result.Success(it.toString()) }
        assertIs<Result.Failure>(chained)
        assertEquals(error, chained.error)
    }

    @Test
    fun flatMapReturnsFailureFromTransform() {
        val result: Result<Int> = Result.Success(10)
        val error = AppError.ConnectionFailed("dropped")
        val chained = result.flatMap<Int, String> { Result.Failure(error) }
        assertIs<Result.Failure>(chained)
        assertEquals(error, chained.error)
    }

    @Test
    fun connectionFailedHasCorrectUserMessage() {
        val error = AppError.ConnectionFailed("no wifi")
        assertEquals("Connection failed. Check your network and try again.", error.userMessage)
    }

    @Test
    fun timeoutHasCorrectUserMessage() {
        val error = AppError.Timeout("fetch")
        assertEquals("Operation timed out. Please try again.", error.userMessage)
    }

    @Test
    fun syncFailedHasCorrectUserMessage() {
        val error = AppError.SyncFailed("conflict")
        assertEquals("Sync failed. Data may be outdated.", error.userMessage)
    }
}
