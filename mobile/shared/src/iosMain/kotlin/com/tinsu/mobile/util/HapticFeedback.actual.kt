package com.tinsu.mobile.util

import platform.UIKit.UIImpactFeedbackGenerator

/**
 * iOS implementation of HapticFeedback using UIImpactFeedbackGenerator.
 */
actual class HapticFeedback {
    private val lightImpactGenerator = UIImpactFeedbackGenerator()
    private val mediumImpactGenerator = UIImpactFeedbackGenerator()

    init {
        lightImpactGenerator.prepare()
        mediumImpactGenerator.prepare()
    }

    actual fun connectionEstablished() {
        lightImpactGenerator.impactOccurred()
    }

    actual fun connectionLost() {
        mediumImpactGenerator.impactOccurred()
    }

    actual fun warning() {
        mediumImpactGenerator.impactOccurred()
    }

    companion object {
        fun create(): HapticFeedback = HapticFeedback()
    }
}
