package com.tinsu.mobile.ui.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Computer
import androidx.compose.material.icons.outlined.DesktopWindows
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.setup.SetupViewModel
import com.tinsu.mobile.ui.components.PrimaryButton

@Composable
fun WelcomeStep(
    viewModel: SetupViewModel,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Title area
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "Welcome to TinSu",
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "Connect to your development machines from anywhere.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(Modifier.height(8.dp))

        // What you'll get
        Text(
            text = "What TinSu does",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "TinSu lets you manage remote development sessions, " +
                "chat with AI agents, review code, and read planning documents " +
                "— all from your mobile device.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(8.dp))

        // Prerequisites card
        Text(
            text = "What you need",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground
        )

        Surface(
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                PrerequisiteItem(
                    icon = { Icon(Icons.Outlined.Computer, "PC", tint = MaterialTheme.colorScheme.primary) },
                    title = "A remote PC with SSH",
                    subtitle = "Linux, macOS, or WSL on Windows"
                )
                PrerequisiteItem(
                    icon = { Icon(Icons.Outlined.Key, "SSH Key", tint = MaterialTheme.colorScheme.primary) },
                    title = "SSH access credentials",
                    subtitle = "Username and hostname/IP"
                )
                PrerequisiteItem(
                    icon = { Icon(Icons.Outlined.DesktopWindows, "Desktop", tint = MaterialTheme.colorScheme.primary) },
                    title = "TinSu Desktop (optional)",
                    subtitle = "For full agent management features"
                )
            }
        }

        Spacer(Modifier.weight(1f))

        // Get Started button
        PrimaryButton(
            text = "Get Started",
            onClick = { viewModel.nextStep() },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun PrerequisiteItem(
    icon: @Composable () -> Unit,
    title: String,
    subtitle: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Surface(
            shape = MaterialTheme.shapes.small,
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.size(40.dp)
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                icon()
            }
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
