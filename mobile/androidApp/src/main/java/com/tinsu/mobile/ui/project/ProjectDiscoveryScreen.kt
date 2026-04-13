package com.tinsu.mobile.ui.project

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FolderOff
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MediumTopAppBar
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.connection.ConnectionEvent
import com.tinsu.mobile.project.ProjectInfo
import com.tinsu.mobile.project.ProjectUiState
import com.tinsu.mobile.project.ProjectViewModel
import com.tinsu.mobile.ui.components.PrimaryButton
import com.tinsu.mobile.ui.components.SecondaryButton
import com.tinsu.mobile.ui.components.ShimmerBox
import com.tinsu.mobile.ui.connection.ConnectionStatusBar
import com.tinsu.mobile.ui.theme.TinsuSpacing
import org.koin.compose.koinInject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectDiscoveryScreen(
    viewModel: ProjectViewModel = koinInject(),
    onProjectSelected: (ProjectInfo) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val pullToRefreshState = rememberPullToRefreshState()

    var showConnectionDetails by remember { mutableStateOf(false) }

    val isLoading = uiState is ProjectUiState.Loading
    val connectionState = (uiState as? ProjectUiState.ProjectsLoaded)?.connectionState ?: ConnectionEvent.Offline

    Scaffold(
        modifier = modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            MediumTopAppBar(
                title = {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Select Project")
                        ConnectionStatusBar(
                            connectionState = connectionState,
                            onClick = { showConnectionDetails = true }
                        )
                    }
                },
                scrollBehavior = scrollBehavior,
                actions = {
                    if (uiState is ProjectUiState.ProjectsLoaded) {
                        IconButton(onClick = { viewModel.refreshProjects() }) {
                            Icon(Icons.Outlined.Refresh, contentDescription = "Refresh")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        PullToRefreshBox(
            isRefreshing = isLoading,
            onRefresh = { viewModel.refreshProjects() },
            state = pullToRefreshState,
            modifier = Modifier.padding(paddingValues)
        ) {
            when (uiState) {
                is ProjectUiState.Idle -> {
                    // Trigger initial discovery
                    LaunchedEffect(Unit) {
                        viewModel.discoverProjects()
                    }
                    LoadingSkeleton()
                }
                is ProjectUiState.Loading -> {
                    LoadingSkeleton()
                }
                is ProjectUiState.ProjectsLoaded -> {
                    val state = uiState as ProjectUiState.ProjectsLoaded
                    if (state.projects.isEmpty() && state.selectedProject == null) {
                        EmptyProjectsState(
                            onRefresh = { viewModel.refreshProjects() }
                        )
                    } else {
                        ProjectList(
                            projects = state.projects,
                            selectedProject = state.selectedProject,
                            onSelect = { project ->
                                viewModel.selectProject(project)
                                onProjectSelected(project)
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
                is ProjectUiState.Error -> {
                    val error = uiState as ProjectUiState.Error
                    ErrorState(
                        message = error.message,
                        isNotFoundError = error.isNotFoundError,
                        onRetry = { viewModel.refreshProjects() },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }

        // Connection details bottom sheet
        if (showConnectionDetails) {
            com.tinsu.mobile.ui.connection.ConnectionDetailsBottomSheet(
                connectionState = connectionState,
                latencyMs = null,
                onDismiss = { showConnectionDetails = false }
            )
        }
    }
}

@Composable
private fun ProjectList(
    projects: List<ProjectInfo>,
    selectedProject: ProjectInfo?,
    onSelect: (ProjectInfo) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(TinsuSpacing.ContentMargin),
        verticalArrangement = Arrangement.spacedBy(TinsuSpacing.ItemSpacing)
    ) {
        items(
            items = projects,
            key = { it.path }
        ) { project ->
            ProjectCard(
                project = project,
                isSelected = project.path == selectedProject?.path,
                onClick = { onSelect(project) }
            )
        }
    }
}

@Composable
private fun LoadingSkeleton(modifier: Modifier = Modifier) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(TinsuSpacing.ContentMargin),
        verticalArrangement = Arrangement.spacedBy(TinsuSpacing.ItemSpacing)
    ) {
        items(3) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp)
            )
        }
    }
}

@Composable
private fun EmptyProjectsState(
    onRefresh: () -> Unit,
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
                imageVector = Icons.Outlined.FolderOff,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.SectionSpacing))
            Text(
                text = "No TinSu Projects Found",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.ItemSpacing))
            Text(
                text = "Make sure your remote PC has TinSu projects with\nan _bmad-output directory in the project root.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.SectionSpacing))
            PrimaryButton(text = "Refresh", onClick = onRefresh)
        }
    }
}

@Composable
private fun ErrorState(
    message: String,
    isNotFoundError: Boolean,
    onRetry: () -> Unit,
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
                imageVector = Icons.Outlined.FolderOff,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.SectionSpacing))
            Text(
                text = if (isNotFoundError) "No Projects Found" else "Discovery Failed",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.ItemSpacing))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.size(TinsuSpacing.SectionSpacing))
            SecondaryButton(text = "Retry", onClick = onRetry)
        }
    }
}
