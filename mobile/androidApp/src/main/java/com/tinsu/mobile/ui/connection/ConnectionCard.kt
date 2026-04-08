package com.tinsu.mobile.ui.connection

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.connection.ConnectionConfig
import com.tinsu.mobile.connection.TransportType
import com.tinsu.mobile.ui.theme.MonospaceCodeStyle
import com.tinsu.mobile.ui.theme.TinsuSpacing
import com.tinsu.mobile.ui.theme.Warning
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes

/**
 * Connection status for the indicator dot.
 */
enum class ConnectionStatus {
    UNKNOWN,
    RECENTLY_CONNECTED,
    FAILED
}

/**
 * Determines the connection status based on last connected timestamp.
 */
fun determineConnectionStatus(lastConnectedAt: Long?): ConnectionStatus {
    if (lastConnectedAt == null) return ConnectionStatus.UNKNOWN

    val now = System.currentTimeMillis()
    val elapsed = now - lastConnectedAt

    return when {
        elapsed < 5.minutes.inWholeMilliseconds -> ConnectionStatus.RECENTLY_CONNECTED
        elapsed < 1.days.inWholeMilliseconds -> ConnectionStatus.RECENTLY_CONNECTED
        else -> ConnectionStatus.UNKNOWN
    }
}

/**
 * Formats the last connected timestamp as a relative time string.
 */
fun formatLastConnected(lastConnectedAt: Long?): String {
    if (lastConnectedAt == null) return "Never"

    val now = System.currentTimeMillis()
    val elapsed = now - lastConnectedAt

    return when {
        elapsed < 60_000 -> "Just now"
        elapsed < 1.hours.inWholeMilliseconds -> "${elapsed / 60_000}m ago"
        elapsed < 1.days.inWholeMilliseconds -> "${elapsed / 3_600_000}h ago"
        elapsed < 7.days.inWholeMilliseconds -> "${elapsed / 86_400_000}d ago"
        else -> "Long ago"
    }
}

/**
 * Connection card composable for displaying saved connections.
 *
 * @param connection The connection configuration to display
 * @param status The connection status (affects indicator color)
 * @param onClick Callback when the card is clicked
 * @param onEdit Callback when the edit button is clicked
 * @param onDelete Callback when the delete button is clicked
 * @param modifier Modifier for the card
 * @param isDraggable Whether the drag handle should be shown
 */
@Composable
fun ConnectionCard(
    connection: ConnectionConfig,
    status: ConnectionStatus = determineConnectionStatus(connection.lastConnectedAt),
    onClick: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
    isDraggable: Boolean = true
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (isDraggable) {
                    Modifier
                } else {
                    Modifier.clickable(onClick = onClick)
                }
            ),
        shape = MaterialTheme.shapes.small,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        border = CardDefaults.outlinedCardBorder()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(TinsuSpacing.CardPadding),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Drag handle (shown when draggable)
            if (isDraggable) {
                Icon(
                    imageVector = Icons.Filled.DragHandle,
                    contentDescription = "Drag to reorder",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .padding(end = TinsuSpacing.ItemSpacing)
                        .size(20.dp)
                )
            }

            // Status indicator dot
            Box(
                modifier = Modifier
                    .padding(end = TinsuSpacing.CardPadding)
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(
                        when (status) {
                            ConnectionStatus.RECENTLY_CONNECTED -> Color(0xFF3FB950)
                            ConnectionStatus.FAILED -> Color(0xFFF85149)
                            ConnectionStatus.UNKNOWN -> Color(0xFF8B949E)
                        }
                    )
            )

            // Connection details
            Column(
                modifier = Modifier.weight(1f)
            ) {
                // Display name (large text)
                Text(
                    text = connection.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                // host:port (secondary text in monospace)
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${connection.host}:${connection.port}",
                        style = MonospaceCodeStyle,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    // Transport type badge
                    Spacer(modifier = Modifier.width(TinsuSpacing.ItemSpacing))
                    Text(
                        text = connection.transportType.displayName,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .background(
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                                shape = MaterialTheme.shapes.extraSmall
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                // Last connected timestamp (tertiary text)
                Text(
                    text = formatLastConnected(connection.lastConnectedAt),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )

                // SSH key alias if present
                connection.sshKeyAlias?.let { alias ->
                    Text(
                        text = "Key: $alias",
                        style = MonospaceCodeStyle,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Action buttons
            Row {
                IconButton(onClick = onEdit) {
                    Icon(
                        imageVector = Icons.Outlined.Edit,
                        contentDescription = "Edit connection",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        imageVector = Icons.Outlined.Delete,
                        contentDescription = "Delete connection",
                        tint = Color(0xFFF85149)
                    )
                }
            }
        }
    }
}
