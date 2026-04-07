package com.tinsu.mobile.util

import android.util.Log

actual class Logger actual constructor(private val tag: String) {
    actual fun debug(message: String) {
        Log.d(tag, message)
    }

    actual fun info(message: String) {
        Log.i(tag, message)
    }

    actual fun warn(message: String) {
        Log.w(tag, message)
    }

    actual fun error(message: String, throwable: Throwable?) {
        Log.e(tag, message, throwable)
    }
}
