package com.tinsu.mobile.ui.setup

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.tinsu.mobile.setup.SetupStep
import com.tinsu.mobile.setup.SetupUiState
import com.tinsu.mobile.setup.SetupViewModel
import com.tinsu.mobile.ui.theme.JetBrainsMono
import org.koin.compose.koinInject

@Composable
fun SetupFlowScreen(
    viewModel: SetupViewModel = koinInject(),
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()

    when (val state = uiState) {
        is SetupUiState.Completed -> {
            onComplete()
            return
        }
        is SetupUiState.StepActive -> {
            StepContainer(
                step = state.step,
                stepIndex = state.stepIndex,
                totalSteps = state.totalSteps,
                viewModel = viewModel,
                modifier = modifier
            )
        }
        is SetupUiState.Testing -> {
            StepContainer(
                step = SetupStep.TEST_CONNECTION,
                stepIndex = SetupStep.TEST_CONNECTION.index,
                totalSteps = SetupStep.TOTAL_STEPS,
                viewModel = viewModel,
                modifier = modifier
            )
        }
        is SetupUiState.TestSuccess -> {
            StepContainer(
                step = SetupStep.TEST_CONNECTION,
                stepIndex = SetupStep.TEST_CONNECTION.index,
                totalSteps = SetupStep.TOTAL_STEPS,
                viewModel = viewModel,
                modifier = modifier
            )
        }
        is SetupUiState.TestFailure -> {
            StepContainer(
                step = SetupStep.TEST_CONNECTION,
                stepIndex = SetupStep.TEST_CONNECTION.index,
                totalSteps = SetupStep.TOTAL_STEPS,
                viewModel = viewModel,
                modifier = modifier
            )
        }
        is SetupUiState.Saving -> {
            StepContainer(
                step = SetupStep.SAVE_CONNECTION,
                stepIndex = SetupStep.SAVE_CONNECTION.index,
                totalSteps = SetupStep.TOTAL_STEPS,
                viewModel = viewModel,
                modifier = modifier
            )
        }
    }
}

@Composable
private fun StepContainer(
    step: SetupStep,
    stepIndex: Int,
    totalSteps: Int,
    viewModel: SetupViewModel,
    modifier: Modifier = Modifier
) {
    val progress = (stepIndex + 1).toFloat() / totalSteps.toFloat()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Progress section
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            Text(
                text = "Step ${stepIndex + 1} of $totalSteps",
                style = MaterialTheme.typography.labelMedium.copy(
                    fontFamily = JetBrainsMono
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
        }

        Divider(
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
            thickness = 1.dp
        )

        // Step content
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            AnimatedContent(
                targetState = step,
                transitionSpec = {
                    if (targetState.index > initialState.index) {
                        slideInHorizontally { it } togetherWith slideOutHorizontally { -it }
                    } else {
                        slideInHorizontally { -it } togetherWith slideOutHorizontally { it }
                    }
                },
                label = "setup-step"
            ) { currentStep ->
                when (currentStep) {
                    SetupStep.WELCOME -> WelcomeStep(viewModel = viewModel)
                    SetupStep.HOST_DETAILS -> HostDetailsStep(viewModel = viewModel)
                    SetupStep.GENERATE_KEY -> GenerateKeyStep(viewModel = viewModel)
                    SetupStep.VIEW_PUBLIC_KEY -> ViewPublicKeyStep(viewModel = viewModel)
                    SetupStep.AUTHORIZED_KEYS_INSTRUCTIONS -> AuthorizedKeysInstructionsStep(viewModel = viewModel)
                    SetupStep.TEST_CONNECTION -> TestConnectionStep(viewModel = viewModel)
                    SetupStep.SAVE_CONNECTION -> SaveConnectionStep(viewModel = viewModel)
                }
            }
        }

        Divider(
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
            thickness = 1.dp
        )

        // Navigation bar
        NavigationBar(
            step = step,
            viewModel = viewModel,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun NavigationBar(
    step: SetupStep,
    viewModel: SetupViewModel,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Back button
        if (step != SetupStep.WELCOME) {
            OutlinedButton(
                onClick = { viewModel.previousStep() },
                modifier = Modifier.height(48.dp)
            ) {
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = "Back",
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text("Back")
            }
        }

        Spacer(Modifier.weight(1f))

        // Skip button (welcome only)
        if (step == SetupStep.WELCOME) {
            TextButton(
                onClick = { viewModel.skipSetup() },
                modifier = Modifier.height(48.dp)
            ) {
                Text(
                    "Skip",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.width(12.dp))
        }
    }
}
