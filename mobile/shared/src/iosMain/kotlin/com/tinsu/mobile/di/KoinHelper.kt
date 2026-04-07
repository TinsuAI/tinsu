package com.tinsu.mobile.di

import org.koin.core.context.GlobalContext
import org.koin.core.context.startKoin

fun initKoin() {
    if (GlobalContext.getOrNull() != null) return
    startKoin {
        modules(sharedModule, iosModule)
    }
}
