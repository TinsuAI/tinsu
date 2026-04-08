package com.tinsu.mobile.ui.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.setup.SetupViewModel
import com.tinsu.mobile.ui.components.PrimaryButton

@Composable
fun SaveConnectionStep(
    viewModel: SetupViewModel,
    modifier: Modifier = Modifier
) {
    var displayName by rememberSaveable { mutableStateOf(viewModel.displayName) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Save Connection",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "Give this connection a name so you can easily identify it later.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = displayName,
            onValueChange = {
                displayName = it
                viewModel.setDisplayName(it)
            },
            label = { Text("Connection Name") },
            placeholder = { Text("e.g. My Dev Server") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = "Summary",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground
        )

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            SummaryRow("Host", viewModel.host)
            SummaryRow("Port", viewModel.port.toString())
            SummaryRow("Username", viewModel.username)
            SummaryRow("Key", viewModel.sshKeyAlias ?: "Not generated")
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = "Save & Connect",
            onClick = {
                viewModel.setDisplayName(displayName)
                viewModel.saveConnection()
            },
            enabled = displayName.isNotBlank() && viewModel.testSessionInfo != null,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
