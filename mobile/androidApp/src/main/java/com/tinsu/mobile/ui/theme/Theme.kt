package com.tinsu.mobile.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// TinsuColors holds non-M3 semantic colors used throughout the app
data class TinsuColors(
    val success: Color,
    val warning: Color,
    val userBubble: Color,
    val agentBubble: Color,
)

val LocalTinsuColors = staticCompositionLocalOf {
    TinsuColors(
        success = Success,
        warning = Warning,
        userBubble = UserBubble,
        agentBubble = AgentBubble,
    )
}

// Access via: MaterialTheme.tinsuColors.success
val ColorScheme.tinsuColors: TinsuColors
    @Composable get() = LocalTinsuColors.current

val TinsuDarkColorScheme = darkColorScheme(
    background = Background,
    surface = Surface,
    surfaceVariant = SurfaceVariant,
    primary = Primary,
    onPrimary = OnPrimary,
    onBackground = OnBackground,
    onSurface = OnSurface,
    onSurfaceVariant = OnSurfaceVariant,
    error = Error,
    outline = Outline,
)

val TinsuLightColorScheme = lightColorScheme(
    background = LightBackground,
    surface = LightSurface,
    surfaceVariant = LightSurfaceVariant,
    primary = LightPrimary,
    onPrimary = LightOnPrimary,
    onBackground = LightOnBackground,
    onSurface = LightOnSurface,
    onSurfaceVariant = LightOnSurfaceVariant,
    error = LightError,
    outline = LightOutline,
)

@Composable
fun TinsuTheme(
    darkTheme: Boolean = true,  // dark-by-default
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) TinsuDarkColorScheme else TinsuLightColorScheme
    val tinsuColors = if (darkTheme) {
        TinsuColors(Success, Warning, UserBubble, AgentBubble)
    } else {
        TinsuColors(LightSuccess, LightWarning, LightPrimary, LightSurface)
    }

    CompositionLocalProvider(LocalTinsuColors provides tinsuColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = TinsuTypography,
            shapes = TinsuShapes,
            content = content,
        )
    }
}
