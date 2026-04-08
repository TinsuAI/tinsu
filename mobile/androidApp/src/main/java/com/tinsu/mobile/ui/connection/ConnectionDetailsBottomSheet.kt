package com.tinsu.mobile.ui.connection

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NetworkCheck
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Server
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tinsu.mobile.connection.ConnectionEvent
import com.tinsu.mobile.connection.ConnectionMonitor
import com.tinsu.mobile.ui.theme.MonospaceCodeStyle

/**
 * Bottom sheet displaying connection details.
 * Shows host, port, transport type, uptime, and latency.
 *
 * @param connectionState The current connection event/state
 * @param latencyMs Optional latency in milliseconds (from ConnectionMonitor)
 * @param onDismiss Callback when the sheet is dismissed
 * @param modifier Modifier for the component
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectionDetailsBottomSheet(
    connectionState: ConnectionEvent,
    latencyMs: Long? = null,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = modifier,
        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Title
            Text(
                text = "Connection Details",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            // Connection information based on state
            when (connectionState) {
                is ConnectionEvent.Connected -> {
                    ConnectedDetails(connectionState, latencyMs)
                }
                is ConnectionEvent.Reconnecting -> {
                    ReconnectingDetails()
                }
                is ConnectionEvent.Disconnected -> {
                    DisconnectedDetails(connectionState)
                }
                is ConnectionEvent.Offline -> {
                    OfflineDetails()
                }
            }
        }
    }
}

@Composable
private fun ConnectedDetails(
    state: ConnectionEvent.Connected,
    latencyMs: Long?
) {
    // Host and Port
    DetailRow(
        icon = Icons.Default.Server,
        label = "Host",
        value = "${state.host}:${state.port}"
    )

    Spacer(modifier = Modifier.height(12.dp))

    // Transport Type
    DetailRow(
        icon = Icons.Default.NetworkCheck,
        label = "Transport",
        value = state.transport.displayName
    )

    Spacer(modifier = Modifier.height(12.dp))

    // Uptime
    val uptimeText = ConnectionMonitor.formatUptime(state.uptime)
    DetailRow(
        icon = Icons.Default.Schedule,
        label = "Uptime",
        value = uptimeText
    )

    // Latency (if available)
    if (latencyMs != null) {
        Spacer(modifier = Modifier.height(12.dp))
        DetailRow(
            icon = Icons.Default.NetworkCheck,
            label = "Latency",
            value = "${latencyMs}ms"
        )
    }
}

@Composable
private fun ReconnectingDetails() {
    Text(
        text = "Reconnecting to remote PC...",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun DisconnectedDetails(state: ConnectionEvent.Disconnected) {
    Text(
        text = "Connection lost or failed.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 8.dp)
    )

    if (state.reason != null) {
        Text(
            text = "Reason: ${state.reason}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error
        )
    }
}

@Composable
private fun OfflineDetails() {
    Text(
        text = "Network is unavailable.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun DetailRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp
            )

            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = FontFamily.Monospace
                ),
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}
