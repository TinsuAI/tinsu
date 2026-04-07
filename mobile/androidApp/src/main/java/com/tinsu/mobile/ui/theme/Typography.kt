package com.tinsu.mobile.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.tinsu.mobile.R

val JetBrainsMono = FontFamily(
    Font(R.font.jetbrains_mono, FontWeight.Normal),
)

// Display/body font: use system Roboto as placeholder
val DisplayFont = FontFamily.Default  // Roboto on Android

val TinsuTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = DisplayFont,
        fontSize = 28.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 36.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = DisplayFont,
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 28.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = DisplayFont,
        fontSize = 18.sp,
        fontWeight = FontWeight.Medium,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = DisplayFont,
        fontSize = 15.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 22.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = DisplayFont,
        fontSize = 13.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 18.sp,
    ),
)

// Extension for code text style — used by ChatBubble, DiffLine (future stories)
val MonospaceCodeStyle = TextStyle(
    fontFamily = JetBrainsMono,
    fontSize = 13.sp,
    fontWeight = FontWeight.Normal,
    lineHeight = 20.sp,
)

val MonospaceLineNumberStyle = TextStyle(
    fontFamily = JetBrainsMono,
    fontSize = 11.sp,
    fontWeight = FontWeight.Normal,
    lineHeight = 20.sp,
)
