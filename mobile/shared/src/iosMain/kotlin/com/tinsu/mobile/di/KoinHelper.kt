package com.tinsu.mobile.di

import com.tinsu.mobile.security.Ed25519KeyProvider
import com.tinsu.mobile.security.SecureKeyStore
import org.koin.core.context.startKoin
import org.koin.dsl.module

fun initKoin(ed25519Provider: Ed25519KeyProvider? = null) {
    try {
        val securityModule = module {
            single { SecureKeyStore(ed25519Provider) }
        }
        startKoin {
            modules(sharedModule, iosModule, securityModule)
        }
    } catch (_: Exception) {
        // Koin already started — safe to ignore on re-entry (e.g. SwiftUI previews)
    }
}
