package com.tinsu.mobile.di

import com.tinsu.mobile.connection.SshSessionProvider
import com.tinsu.mobile.security.Ed25519KeyProvider
import com.tinsu.mobile.security.SecureKeyStore
import com.tinsu.mobile.setup.SetupDetector
import com.tinsu.mobile.setup.SetupViewModel
import org.koin.core.context.startKoin
import org.koin.dsl.module

fun initKoin(
    ed25519Provider: Ed25519KeyProvider? = null,
    sshProvider: SshSessionProvider? = null
) {
    try {
        val platformModule = module {
            single { SecureKeyStore(ed25519Provider) }
            single<SshSessionProvider?> { sshProvider }
        }
        startKoin {
            modules(sharedModule, iosModule, platformModule)
        }
    } catch (_: Exception) {
        // Koin already started — safe to ignore on re-entry (e.g. SwiftUI previews)
    }
}

fun getSetupViewModel(): SetupViewModel {
    return org.koin.core.context.GlobalContext.get().get<SetupViewModel>()
}

fun getSetupDetector(): SetupDetector {
    return org.koin.core.context.GlobalContext.get().get<SetupDetector>()
}
