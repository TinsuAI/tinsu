package com.tinsu.mobile.ui.connection

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rewind
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.connection.ConnectionEvent

/**
 * Compact connection status bar component.
 * Displays an 8dp dot + label indicating current connection state.
 *
 * @param connectionState The current connection event/state
 * @param onClick Callback when the status bar is tapped
 * @param modifier Modifier for the component
 */
@Composable
fun ConnectionStatusBar(
    connectionState: ConnectionEvent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val (statusText, statusColor) = when (connectionState) {
        is ConnectionEvent.Connected -> {
            Pair("Connected", MaterialTheme.colorScheme.tinsuColors.success)
        }
        is ConnectionEvent.Reconnecting -> {
            Pair("Reconnecting...", MaterialTheme.colorScheme.tinsuColors.warning)
        }
        is ConnectionEvent.Disconnected -> {
            Pair("Disconnected", MaterialTheme.colorScheme.error)
        }
        is ConnectionEvent.Offline -> {
            Pair("Offline", MaterialTheme.colorScheme.outline)
        }
    }

    // Animate color transition with 200ms fade
    val animatedColor by animateColorAsState(
        targetValue = statusColor,
        animationSpec = tween(durationMillis = 200),
        label = "statusColor"
    )

    // Pulse animation for Reconnecting state
    val pulseAlpha by animateFloatAsState(
        targetValue = if (connectionState is ConnectionEvent.Reconnecting) 0.5f else 1.0f,
        animationSpec = if (connectionState is ConnectionEvent.Reconnecting) {
            infiniteRepeatable(
                animation = tween(durationMillis = 1000),
                repeatMode = androidx.compose.animation.core.RepeatMode.Reverse
            )
        } else {
            tween(durationMillis = 200)
        },
        label = "pulseAlpha"
    )

    Row(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Status indicator dot (8dp)
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(animatedColor, CircleShape)
                .alpha(pulseAlpha)
        )

        // Status text label
        Text(
            text = statusText,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
