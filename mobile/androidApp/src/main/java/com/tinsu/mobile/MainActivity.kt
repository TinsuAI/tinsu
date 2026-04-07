package com.tinsu.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.tinsu.mobile.ui.TinsuApp
import com.tinsu.mobile.ui.theme.TinsuTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TinsuTheme {
                TinsuApp()
            }
        }
    }
}
