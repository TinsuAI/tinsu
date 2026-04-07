package com.tinsu.mobile.util

sealed interface AppError {
    val userMessage: String

    data class ConnectionFailed(val reason: String) : AppError {
        override val userMessage: String get() = "Connection failed. Check your network and try again."
    }

    data class Timeout(val operation: String) : AppError {
        override val userMessage: String get() = "Operation timed out. Please try again."
    }

    data class SyncFailed(val reason: String) : AppError {
        override val userMessage: String get() = "Sync failed. Data may be outdated."
    }

    data class KeyGenerationFailed(val reason: String) : AppError {
        override val userMessage: String get() = "Key generation failed: $reason"
    }

    data class KeyNotFound(val alias: String) : AppError {
        override val userMessage: String get() = "Key '$alias' not found."
    }
}
