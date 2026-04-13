package com.tinsu.mobile.ui.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.setup.SetupViewModel
import com.tinsu.mobile.ui.components.PrimaryButton
import com.tinsu.mobile.ui.theme.JetBrainsMono

@Composable
fun AuthorizedKeysInstructionsStep(
    viewModel: SetupViewModel,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Add Key to Remote Machine",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "Add your public key to the remote PC so you can connect without a password.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(8.dp))

        // Quick method
        Text(
            text = "Quick Method",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground
        )

        Surface(
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "ssh-copy-id -i ~/.ssh/tinsu_key.pub ${viewModel.username}@${viewModel.host}",
                style = MaterialTheme.typography.bodySmall.copy(
                    fontFamily = JetBrainsMono,
                ),
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(16.dp)
            )
        }

        Spacer(Modifier.height(8.dp))

        // Manual method
        Text(
            text = "Manual Steps",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground
        )

        val steps = listOf(
            "SSH into your remote machine: ssh ${viewModel.username}@${viewModel.host}",
            "Create the .ssh directory: mkdir -p ~/.ssh && chmod 700 ~/.ssh",
            "Open authorized_keys: nano ~/.ssh/authorized_keys",
            "Paste your public key on a new line, then save the file",
            "Set permissions: chmod 600 ~/.ssh/authorized_keys"
        )

        steps.forEachIndexed { index, step ->
            StepItem(number = index + 1, text = step)
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = "I've Added the Key",
            onClick = { viewModel.nextStep() },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun StepItem(
    number: Int,
    text: String
) {
    Column(
        modifier = Modifier.padding(bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = "Step $number",
            style = MaterialTheme.typography.labelMedium.copy(
                fontFamily = JetBrainsMono
            ),
            color = MaterialTheme.colorScheme.primary
        )
        Surface(
            shape = MaterialTheme.shapes.small,
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.bodySmall.copy(
                    fontFamily = JetBrainsMono,
                ),
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(12.dp)
            )
        }
    }
}
