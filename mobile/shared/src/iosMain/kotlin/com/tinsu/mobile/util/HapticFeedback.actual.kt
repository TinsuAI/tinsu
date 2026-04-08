package com.tinsu.mobile.util

import platform.UIKit.UIImpactFeedbackGenerator
import platform.UIKit.UIFeedbackGenerator

/**
 * iOS implementation of HapticFeedback using UIImpactFeedbackGenerator.
 */
actual class HapticFeedback {
    private val lightImpactGenerator = UIImpactFeedbackGenerator(UIImpactFeedbackGenerator.UIImpactFeedbackStyleLight)
    private val mediumImpactGenerator = UIImpactFeedbackGenerator(UIImpactFeedbackGenerator.UIImpactFeedbackStyleMedium)

    init {
        // Prepare generators for immediate feedback
        lightImpactGenerator.prepare()
        mediumImpactGenerator.prepare()
    }

    /**
     * Light impact for successful connection establishment.
     */
    actual fun connectionEstablished() {
        lightImpactGenerator.impactOccurred(0)
    }

    /**
     * Medium impact for connection loss.
     */
    actual fun connectionLost() {
        mediumImpactGenerator.impactOccurred(0)
    }

    /**
     * Medium impact for warnings.
     */
    actual fun warning() {
        mediumImpactGenerator.impactOccurred(0)
    }

    companion object {
        /**
         * Creates a HapticFeedback instance.
         * This factory method should be used in Koin DI modules.
         */
        fun create(): HapticFeedback {
            return HapticFeedback()
        }
    }
}
