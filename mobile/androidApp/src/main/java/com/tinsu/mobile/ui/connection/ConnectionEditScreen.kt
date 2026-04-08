package com.tinsu.mobile.ui.connection

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.connection.ConnectionConfig
import com.tinsu.mobile.connection.ConnectionErrorType
import com.tinsu.mobile.connection.ConnectionListViewModel
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.ConnectionTestState
import com.tinsu.mobile.connection.SessionInfo
import com.tinsu.mobile.connection.TransportType
import com.tinsu.mobile.ui.components.DestructiveButton
import com.tinsu.mobile.ui.components.PrimaryButton
import com.tinsu.mobile.ui.components.SecondaryButton
import com.tinsu.mobile.ui.theme.MonospaceCodeStyle
import com.tinsu.mobile.ui.theme.TinsuSpacing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.koin.compose.koinInject

/**
 * Connection edit screen for creating and editing connections.
 *
 * @param existingConnection The connection to edit, or null for a new connection
 * @param viewModel The ConnectionListViewModel injected via Koin
 * @param onSave Callback when the connection is saved successfully
 * @param onCancel Callback when the user cancels editing
 * @param modifier Modifier for the screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectionEditScreen(
    existingConnection: ConnectionConfig? = null,
    repository: ConnectionRepository = koinInject(),
    viewModel: ConnectionListViewModel = koinInject(),
    onSave: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
    val coroutineScope = rememberCoroutineScope()

    // Form state
    var displayName by remember { mutableStateOf(existingConnection?.displayName ?: "") }
    var host by remember { mutableStateOf(existingConnection?.host ?: "") }
    var port by remember { mutableStateOf(existingConnection?.port?.toString() ?: "22") }
    var username by remember { mutableStateOf(existingConnection?.username ?: "") }
    var transportType by remember { mutableStateOf(existingConnection?.transportType ?: TransportType.SSH) }
    var sshKeyAlias by remember { mutableStateOf(existingConnection?.sshKeyAlias ?: "") }

    // Validation errors
    var displayNameError by remember { mutableStateOf<String?>(null) }
    var hostError by remember { mutableStateOf<String?>(null) }
    var usernameError by remember { mutableStateOf<String?>(null) }
    var portError by remember { mutableStateOf<String?>(null) }
    var generalError by remember { mutableStateOf<String?>(null) }

    val isEditing = existingConnection != null

    // Test connection state
    val testStateMap by viewModel.testState.collectAsState()
    val stateKey = existingConnection?.id ?: "__new_${host}_${port}"
    val testState = testStateMap[stateKey] ?: ConnectionTestState.Idle
    val isTested = viewModel.isConnectionTested(stateKey)

    // For new connections, Save is disabled until test passes
    val canSave = isEditing || isTested

    fun validateAndSave() {
        displayNameError = null
        hostError = null
        usernameError = null
        portError = null
        generalError = null

        var isValid = true

        if (displayName.trim().isEmpty()) {
            displayNameError = "Display name is required"
            isValid = false
        } else if (displayName.trim().length > 50) {
            displayNameError = "Display name must be 50 characters or less"
            isValid = false
        }

        if (host.trim().isEmpty()) {
            hostError = "Host is required"
            isValid = false
        } else if (host.trim().length > 255) {
            hostError = "Host must be 255 characters or less"
            isValid = false
        }

        if (username.trim().isEmpty()) {
            usernameError = "Username is required"
            isValid = false
        } else if (username.trim().length > 100) {
            usernameError = "Username must be 100 characters or less"
            isValid = false
        }

        val portNum = port.toIntOrNull()
        if (portNum == null) {
            portError = "Port must be a number"
            isValid = false
        } else if (portNum < 1 || portNum > 65535) {
            portError = "Port must be between 1 and 65535"
            isValid = false
        }

        if (!isValid) return

        if (!isEditing && !isTested) {
            generalError = "Test your connection before saving"
            return
        }

        val portValue = portNum!!

        val config = existingConnection?.copy(
            displayName = displayName.trim(),
            host = host.trim(),
            port = portValue,
            username = username.trim(),
            transportType = transportType,
            sshKeyAlias = sshKeyAlias.trim().ifEmpty { null }
        ) ?: ConnectionConfig(
            displayName = displayName.trim(),
            host = host.trim(),
            port = portValue,
            username = username.trim(),
            transportType = transportType,
            sshKeyAlias = sshKeyAlias.trim().ifEmpty { null }
        )

        coroutineScope.launch {
            val result = if (isEditing) {
                repository.updateConnection(config)
            } else {
                repository.createConnection(config)
            }

            when (result) {
                is com.tinsu.mobile.util.Result.Success -> onSave()
                is com.tinsu.mobile.util.Result.Failure -> {
                    generalError = result.error.userMessage
                }
            }
        }
    }

    fun triggerTestConnection() {
        val portNum = port.toIntOrNull() ?: return
        val config = existingConnection?.copy(
            host = host.trim(),
            port = portNum,
            username = username.trim(),
            sshKeyAlias = sshKeyAlias.trim().ifEmpty { null }
        ) ?: ConnectionConfig(
            displayName = displayName.trim(),
            host = host.trim(),
            port = portNum,
            username = username.trim(),
            transportType = transportType,
            sshKeyAlias = sshKeyAlias.trim().ifEmpty { null }
        )
        viewModel.testConnection(config)
    }

    Scaffold(
        modifier = modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            TopAppBar(
                title = { Text(if (isEditing) "Edit Connection" else "New Connection") },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Cancel"
                        )
                    }
                },
                scrollBehavior = scrollBehavior
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(TinsuSpacing.ContentMargin)
                .verticalScroll(rememberScrollState())
                .imePadding(),
            verticalArrangement = Arrangement.spacedBy(TinsuSpacing.ItemSpacing)
        ) {
            // General error message
            generalError?.let { error ->
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }

            // Display Name field
            OutlinedTextField(
                value = displayName,
                onValueChange = {
                    displayName = it
                    displayNameError = null
                },
                label = { Text("Display Name") },
                placeholder = { Text("My Server") },
                isError = displayNameError != null,
                supportingText = displayNameError?.let { { Text(it) } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    errorBorderColor = MaterialTheme.colorScheme.error,
                    errorSupportingTextColor = MaterialTheme.colorScheme.error
                )
            )

            // Host field
            OutlinedTextField(
                value = host,
                onValueChange = {
                    host = it
                    hostError = null
                },
                label = { Text("Host") },
                placeholder = { Text("example.com or 192.168.1.100") },
                isError = hostError != null,
                supportingText = hostError?.let { { Text(it) } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    errorBorderColor = MaterialTheme.colorScheme.error,
                    errorSupportingTextColor = MaterialTheme.colorScheme.error
                )
            )

            // Port and Username row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(TinsuSpacing.ItemSpacing)
            ) {
                OutlinedTextField(
                    value = port,
                    onValueChange = {
                        port = it
                        portError = null
                    },
                    label = { Text("Port") },
                    isError = portError != null,
                    supportingText = portError?.let { { Text(it) } },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    colors = OutlinedTextFieldDefaults.colors(
                        errorBorderColor = MaterialTheme.colorScheme.error,
                        errorSupportingTextColor = MaterialTheme.colorScheme.error
                    )
                )

                OutlinedTextField(
                    value = username,
                    onValueChange = {
                        username = it
                        usernameError = null
                    },
                    label = { Text("Username") },
                    placeholder = { Text("user") },
                    isError = usernameError != null,
                    supportingText = usernameError?.let { { Text(it) } },
                    singleLine = true,
                    modifier = Modifier.weight(2f),
                    colors = OutlinedTextFieldDefaults.colors(
                        errorBorderColor = MaterialTheme.colorScheme.error,
                        errorSupportingTextColor = MaterialTheme.colorScheme.error
                    )
                )
            }

            // Transport Type Selection
            Text(
                text = "Transport",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(TinsuSpacing.ItemSpacing)
            ) {
                TransportType.entries.forEach { type ->
                    Button(
                        onClick = { transportType = type },
                        colors = if (transportType == type) {
                            ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary
                            )
                        } else {
                            ButtonDefaults.outlinedButtonColors()
                        }
                    ) {
                        Text(type.displayName)
                    }
                }
            }

            // SSH Key Alias
            OutlinedTextField(
                value = sshKeyAlias,
                onValueChange = { sshKeyAlias = it },
                label = { Text("SSH Key Alias") },
                placeholder = { Text("my-ssh-key") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                textStyle = MonospaceCodeStyle
            )

            // --- Test Connection Section ---
            Spacer(modifier = Modifier.size(TinsuSpacing.ItemSpacing))

            TestConnectionSection(
                testState = testState,
                onTestClick = { triggerTestConnection() },
                isTesting = testState is ConnectionTestState.Testing
            )

            // Mandatory test notice for new connections
            if (!isEditing && !isTested) {
                Text(
                    text = "Test your connection before saving",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontFamily = FontFamily.Monospace
                )
            }

            Spacer(modifier = Modifier.size(TinsuSpacing.ItemSpacing))

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(TinsuSpacing.ItemSpacing)
            ) {
                SecondaryButton(
                    text = "Cancel",
                    onClick = onCancel,
                    modifier = Modifier.weight(1f)
                )
                PrimaryButton(
                    text = if (isEditing) "Save" else "Create",
                    onClick = { validateAndSave() },
                    modifier = Modifier.weight(1f),
                    enabled = canSave
                )
            }

            if (isEditing) {
                Spacer(modifier = Modifier.size(TinsuSpacing.ItemSpacing))
                DestructiveButton(
                    text = "Delete Connection",
                    onClick = { /* Handle delete - shown on edit only */ },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun TestConnectionSection(
    testState: ConnectionTestState,
    onTestClick: () -> Unit,
    isTesting: Boolean
) {
    Column(verticalArrangement = Arrangement.spacedBy(TinsuSpacing.ItemSpacing)) {
        // Test Connection button
        Button(
            onClick = onTestClick,
            enabled = !isTesting,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = Color.Transparent,
                disabledContainerColor = Color.Transparent
            ),
            shape = RoundedCornerShape(4.dp)
        ) {
            if (isTesting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.size(8.dp))
                Text("Testing...", style = MaterialTheme.typography.labelMedium)
            } else {
                Text("Test Connection", style = MaterialTheme.typography.labelMedium)
            }
        }

        // Result display
        AnimatedVisibility(
            visible = testState is ConnectionTestState.Success || testState is ConnectionTestState.Failure,
            enter = fadeIn() + slideInVertically(),
            exit = fadeOut() + slideOutVertically()
        ) {
            when (testState) {
                is ConnectionTestState.Success -> TestSuccessCard(testState.sessionInfo)
                is ConnectionTestState.Failure -> TestFailureCard(testState)
                else -> {}
            }
        }
    }
}

@Composable
private fun TestSuccessCard(sessionInfo: SessionInfo) {
    val successColor = Color(0xFF3FB950)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(successColor.copy(alpha = 0.1f))
            .border(1.dp, successColor.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
            .padding(TinsuSpacing.CardPadding)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Filled.CheckCircle,
                contentDescription = "Connected",
                tint = successColor,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.size(12.dp))
            Column {
                Text(
                    text = "Connected successfully",
                    style = MaterialTheme.typography.bodyMedium,
                    color = successColor
                )
                Text(
                    text = "${sessionInfo.authenticatedAs}@${sessionInfo.host}:${sessionInfo.port}",
                    style = MonospaceCodeStyle,
                    color = successColor.copy(alpha = 0.7f)
                )
                if (sessionInfo.serverVersion.isNotBlank()) {
                    Text(
                        text = sessionInfo.serverVersion,
                        style = MonospaceCodeStyle.copy(fontSize = MonospaceCodeStyle.fontSize * 0.85f),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun TestFailureCard(failure: ConnectionTestState.Failure) {
    val errorColor = Color(0xFFF85149)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(errorColor.copy(alpha = 0.08f))
            .border(1.dp, errorColor.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
            .padding(TinsuSpacing.CardPadding)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.Error,
                    contentDescription = "Connection failed",
                    tint = errorColor,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.size(12.dp))
                Text(
                    text = errorLabel(failure.errorType),
                    style = MaterialTheme.typography.bodyMedium,
                    color = errorColor
                )
            }

            Spacer(modifier = Modifier.size(8.dp))

            Text(
                text = failure.message,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (failure.hints.isNotEmpty()) {
                Spacer(modifier = Modifier.size(8.dp))
                Column {
                    Text(
                        text = "Troubleshooting:",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    failure.hints.forEach { hint ->
                        Row(modifier = Modifier.padding(start = 8.dp, top = 2.dp)) {
                            Text(
                                text = "  > ",
                                style = MonospaceCodeStyle.copy(fontSize = MonospaceCodeStyle.fontSize * 0.85f),
                                color = Color(0xFFD29922)
                            )
                            Text(
                                text = hint,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun errorLabel(errorType: ConnectionErrorType): String = when (errorType) {
    ConnectionErrorType.HOST_UNREACHABLE -> "Host Unreachable"
    ConnectionErrorType.AUTH_FAILED -> "Authentication Failed"
    ConnectionErrorType.TIMEOUT -> "Connection Timed Out"
    ConnectionErrorType.PORT_BLOCKED -> "Port Blocked"
    ConnectionErrorType.KEY_NOT_FOUND -> "SSH Key Not Found"
    ConnectionErrorType.NETWORK_ERROR -> "Network Error"
    ConnectionErrorType.UNKNOWN -> "Connection Failed"
}
