package com.tinsu.mobile.util

/**
 * Platform-specific haptic feedback for connection state changes.
 * Uses expect/actual pattern for Android Vibrator and iOS UIImpactFeedbackGenerator.
 */
expect class HapticFeedback {
    /**
     * Light vibration for successful connection establishment.
     */
    fun connectionEstablished()

    /**
     * Medium vibration for connection loss.
     */
    fun connectionLost()

    /**
     * Medium vibration for warnings (e.g., reconnection).
     */
    fun warning()
}
