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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.setup.SetupViewModel
import com.tinsu.mobile.ui.components.PrimaryButton

@Composable
fun HostDetailsStep(
    viewModel: SetupViewModel,
    modifier: Modifier = Modifier
) {
    var host by rememberSaveable { mutableStateOf(viewModel.host) }
    var port by rememberSaveable { mutableIntStateOf(viewModel.port) }
    var username by rememberSaveable { mutableStateOf(viewModel.username) }

    val isValid = host.isNotBlank() && username.isNotBlank() && port in 1..65535

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Enter Host Details",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "Provide the SSH connection details for your remote PC.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = host,
            onValueChange = {
                host = it
                viewModel.setHostDetails(host, port, username)
            },
            label = { Text("Host") },
            placeholder = { Text("e.g. 192.168.1.100 or myserver.com") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = port.toString(),
            onValueChange = {
                val parsed = it.toIntOrNull()
                if (parsed != null && parsed in 1..65535) {
                    port = parsed
                } else if (it.isEmpty()) {
                    port = 22
                }
                viewModel.setHostDetails(host, port, username)
            },
            label = { Text("Port") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = username,
            onValueChange = {
                username = it
                viewModel.setHostDetails(host, port, username)
            },
            label = { Text("Username") },
            placeholder = { Text("e.g. root or ubuntu") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = "Next",
            onClick = {
                viewModel.setHostDetails(host, port, username)
                viewModel.nextStep()
            },
            enabled = isValid,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
