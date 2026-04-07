package com.tinsu.mobile.util

import platform.Foundation.NSLog

actual class Logger actual constructor(private val tag: String) {
    actual fun debug(message: String) {
        NSLog("[$tag] DEBUG: $message")
    }

    actual fun info(message: String) {
        NSLog("[$tag] INFO: $message")
    }

    actual fun warn(message: String) {
        NSLog("[$tag] WARN: $message")
    }

    actual fun error(message: String, throwable: Throwable?) {
        NSLog("[$tag] ERROR: $message${throwable?.let { " | ${it.stackTraceToString()}" } ?: ""}")
    }
}
