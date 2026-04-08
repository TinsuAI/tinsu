package com.tinsu.mobile.ui.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.setup.SetupViewModel
import com.tinsu.mobile.ui.components.PrimaryButton
import com.tinsu.mobile.ui.theme.JetBrainsMono
import com.tinsu.mobile.ui.theme.Success

@Composable
fun GenerateKeyStep(
    viewModel: SetupViewModel,
    modifier: Modifier = Modifier
) {
    val keyAlias = viewModel.sshKeyAlias

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Generate SSH Key",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "An Ed25519 key pair will be generated and stored securely on this device.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(16.dp))

        if (keyAlias == null) {
            PrimaryButton(
                text = "Generate Ed25519 Key",
                onClick = { viewModel.generateKey() },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(8.dp))

            Text(
                text = "Ed25519 is the recommended key type — faster and more secure than RSA.",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            Surface(
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        Icons.Outlined.CheckCircle,
                        contentDescription = "Key generated",
                        tint = Success,
                        modifier = Modifier.size(48.dp)
                    )
                    Text(
                        text = "Key Generated",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = keyAlias,
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontFamily = FontFamily(JetBrainsMono)
                        ),
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(Modifier.weight(1f))

            PrimaryButton(
                text = "Next",
                onClick = { viewModel.nextStep() },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
