package com.tinsu.mobile.ui.connection

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.connection.ConnectionConfig
import com.tinsu.mobile.connection.ConnectionListViewModel
import com.tinsu.mobile.ui.components.PrimaryButton
import com.tinsu.mobile.ui.theme.TinsuSpacing
import org.koin.compose.koinInject

/**
 * Connection list screen that displays saved connections.
 *
 * @param viewModel The ConnectionListViewModel injected via Koin
 * @param onConnectionClick Callback when a connection is clicked
 * @param onAddConnection Callback when the add connection button is clicked
 * @param onEditConnection Callback when the edit button is clicked
 * @param modifier Modifier for the screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectionListScreen(
    viewModel: ConnectionListViewModel = koinInject(),
    onConnectionClick: (ConnectionConfig) -> Unit,
    onAddConnection: () -> Unit,
    onEditConnection: (ConnectionConfig) -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
    val pullToRefreshState = rememberPullToRefreshState()

    var deleteConfirmation by remember { mutableStateOf<ConnectionConfig?>(null) }
    var showConnectionDetails by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Connections")
                        ConnectionStatusBar(
                            connectionState = uiState.connectionState,
                            onClick = { showConnectionDetails = true }
                        )
                    }
                },
                scrollBehavior = scrollBehavior
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onAddConnection,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add connection"
                )
            }
        }
    ) { paddingValues ->
        PullToRefreshBox(
            isRefreshing = uiState.isLoading,
            onRefresh = { viewModel.loadConnections() },
            state = pullToRefreshState,
            modifier = Modifier.padding(paddingValues)
        ) {
            when {
                uiState.isEmpty -> {
                    EmptyConnectionsState(
                        onAddConnection = onAddConnection,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                uiState.connections.isNotEmpty() -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(TinsuSpacing.ContentMargin),
                        verticalArrangement = Arrangement.spacedBy(TinsuSpacing.ItemSpacing)
                    ) {
                        items(
                            items = uiState.connections,
                            key = { it.id ?: it.hashCode() }
                        ) { connection ->
                            // Use the ConnectionCard from ConnectionCard.kt with drag support
                            ConnectionCard(
                                connection = connection,
                                onClick = { onConnectionClick(connection) },
                                onEdit = { onEditConnection(connection) },
                                onDelete = { deleteConfirmation = connection },
                                isDraggable = false // LazyColumn doesn't support drag reorder yet - TODO: implement with ReorderableItem library
                            )
                        }
                    }
                }
            }
        }

        // Error message card (simplified as inline alert for now)
        uiState.error?.let { error ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(TinsuSpacing.ContentMargin),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(TinsuSpacing.CardPadding),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Settings,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.size(TinsuSpacing.ItemSpacing))
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }
    }

    // Delete confirmation dialog
    deleteConfirmation?.let { connection ->
        AlertDialog(
            onDismissRequest = { deleteConfirmation = null },
            title = { Text("Delete Connection?") },
            text = {
                Text(
                    "Are you sure you want to delete \"${connection.displayName}\"? " +
                    "This action cannot be undone."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteConnection(connection.id ?: return@TextButton)
                        deleteConfirmation = null
                    }
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteConfirmation = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Connection details bottom sheet
    if (showConnectionDetails) {
        ConnectionDetailsBottomSheet(
            connectionState = uiState.connectionState,
            latencyMs = null,
            onDismiss = { showConnectionDetails = false }
        )
    }
}

/**
 * Empty state shown when no connections exist.
 */
@Composable
private fun EmptyConnectionsState(
    onAddConnection: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Outlined.Settings,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.SectionSpacing))
            Text(
                text = "No Connections Yet",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.ItemSpacing))
            Text(
                text = "Add your first remote PC connection to get started.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.SectionSpacing))
            PrimaryButton(
                text = "Add Connection",
                onClick = onAddConnection
            )
        }
    }
}
