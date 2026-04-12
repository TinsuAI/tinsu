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
import com.tinsu.mobile.ui.components.SecondaryButton
import com.tinsu.mobile.ui.theme.JetBrainsMono

@Composable
fun ViewPublicKeyStep(
    viewModel: SetupViewModel,
    modifier: Modifier = Modifier
) {
    val publicKey = viewModel.getPublicKey() ?: ""

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Your Public Key",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "Copy this key and add it to your remote machine's authorized_keys file.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(8.dp))

        Surface(
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                Text(
                    text = publicKey.ifEmpty { "No key generated yet." },
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontFamily = JetBrainsMono
                    ),
                    color = if (publicKey.isNotEmpty()) {
                        MaterialTheme.colorScheme.onSurface
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        PrimaryButton(
            text = "Copy to Clipboard",
            onClick = {
                viewModel.copyPublicKeyToClipboard()
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = publicKey.isNotEmpty()
        )

        SecondaryButton(
            text = "I've Copied My Key",
            onClick = { viewModel.nextStep() },
            modifier = Modifier.fillMaxWidth(),
            enabled = publicKey.isNotEmpty()
        )
    }
}
