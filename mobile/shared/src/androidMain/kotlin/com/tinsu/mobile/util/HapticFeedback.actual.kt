package com.tinsu.mobile.util

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.content.ContextCompat

/**
 * Android implementation of HapticFeedback using Vibrator.
 */
actual class HapticFeedback(
    private val vibrator: Vibrator
) {
    /**
     * Light vibration for successful connection establishment (100ms).
     */
    actual fun connectionEstablished() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Use VibrationEffect for API 26+
            val effect = VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE)
            vibrator.vibrate(effect)
        } else {
            // Fallback for older API levels
            @Suppress("DEPRECATION")
            vibrator.vibrate(100)
        }
    }

    /**
     * Medium vibration for connection loss (200ms).
     */
    actual fun connectionLost() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE)
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(200)
        }
    }

    /**
     * Medium vibration for warnings (150ms).
     */
    actual fun warning() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE)
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(150)
        }
    }

    companion object {
        /**
         * Creates a HapticFeedback instance with the system Vibrator.
         * This factory method should be used in Koin DI modules.
         */
        fun create(context: Context): HapticFeedback {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // API 31+: Use VibratorManager
                val vibratorManager = ContextCompat.getSystemService(
                    context,
                    VibratorManager::class.java
                )
                vibratorManager?.defaultVibrator
            } else {
                // API <31: Use system service directly
                @Suppress("DEPRECATION")
                ContextCompat.getSystemService(
                    context,
                    Vibrator::class.java
                )
            }

            return HapticFeedback(
                vibrator ?: throw IllegalStateException("Vibrator service not available")
            )
        }
    }
}
