package com.tinsu.mobile.di

import org.koin.core.context.startKoin

fun initKoin() {
    try {
        startKoin {
            modules(sharedModule, iosModule)
        }
    } catch (e: Exception) {
        // Already initialized — ignore
    }
}
