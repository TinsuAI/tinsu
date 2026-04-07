package com.tinsu.mobile.di

import org.koin.core.context.startKoin

fun initKoin() {
    try {
        startKoin {
            modules(sharedModule, iosModule)
        }
    } catch (_: Exception) {
        // Koin already started — safe to ignore on re-entry (e.g. SwiftUI previews)
    }
}
