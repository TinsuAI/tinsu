package com.tinsu.mobile.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Assignment
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MediumTopAppBar
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.tinsu.mobile.ui.components.DestructiveButton
import com.tinsu.mobile.ui.components.PrimaryButton
import com.tinsu.mobile.ui.components.SecondaryButton
import com.tinsu.mobile.ui.components.ShimmerBox
import com.tinsu.mobile.ui.navigation.Routes
import com.tinsu.mobile.ui.theme.TinsuTheme

enum class TinsuTab(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    CHAT(Routes.CHAT, "Chat", Icons.AutoMirrored.Outlined.Chat),
    DOCS(Routes.DOCS, "Docs", Icons.Outlined.Description),
    TASKS(Routes.TASKS, "Tasks", Icons.AutoMirrored.Outlined.Assignment),
    SETTINGS(Routes.SETTINGS, "Settings", Icons.Outlined.Settings),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TinsuApp() {
    val navController = rememberNavController()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            MediumTopAppBar(
                title = { Text("TinSu") },
                scrollBehavior = scrollBehavior,
            )
        },
        bottomBar = {
            TinsuBottomNavigation(navController = navController)
        },
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = TinsuTab.CHAT.route,
            modifier = Modifier.padding(paddingValues),
        ) {
            composable(TinsuTab.CHAT.route) { Box(Modifier.fillMaxSize()) }
            composable(TinsuTab.DOCS.route) { Box(Modifier.fillMaxSize()) }
            composable(TinsuTab.TASKS.route) { Box(Modifier.fillMaxSize()) }
            composable(TinsuTab.SETTINGS.route) { Box(Modifier.fillMaxSize()) }
        }
    }
}

@Composable
private fun TinsuBottomNavigation(navController: NavController) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
        TinsuTab.entries.forEach { tab ->
            NavigationBarItem(
                selected = currentRoute == tab.route,
                onClick = {
                    navController.navigate(tab.route) {
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = {
                    BadgedBox(badge = { /* badge count — populated in future stories */ }) {
                        Icon(tab.icon, contentDescription = tab.label)
                    }
                },
                label = { Text(tab.label) },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Preview(showBackground = true, name = "Terminal Luxe — Dark Theme")
@Composable
private fun TinsuAppPreview() {
    TinsuTheme(darkTheme = true) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Top app bar preview
            MediumTopAppBar(
                title = { Text("TinSu") },
                scrollBehavior = null,
            )

            // Buttons preview
            Row(modifier = Modifier.padding(16.dp)) {
                PrimaryButton(text = "Primary", onClick = {}, modifier = Modifier.padding(end = 8.dp))
                SecondaryButton(text = "Secondary", onClick = {})
            }
            Row(modifier = Modifier.padding(horizontal = 16.dp)) {
                DestructiveButton(text = "Destructive", onClick = {}, modifier = Modifier.padding(end = 8.dp))
            }

            // Shimmer preview
            ShimmerBox(
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth()
                    .height(48.dp),
            )
            ShimmerBox(
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .width(200.dp)
                    .height(20.dp),
            )

            // Navigation bar preview
            val navController = rememberNavController()
            TinsuBottomNavigation(navController = navController)
        }
    }
}
