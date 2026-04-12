package com.tinsu.mobile.di

import com.tinsu.mobile.connection.ConnectionManager
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.SshSessionProvider
import com.tinsu.mobile.project.ProjectViewModel
import com.tinsu.mobile.security.Ed25519KeyProvider
import com.tinsu.mobile.security.SecureKeyStore
import com.tinsu.mobile.setup.SetupDetector
import com.tinsu.mobile.setup.SetupViewModel
import org.koin.core.context.startKoin
import org.koin.dsl.module
import org.koin.mp.KoinPlatform

fun initKoin(
    ed25519Provider: Ed25519KeyProvider? = null,
    sshProvider: SshSessionProvider? = null
) {
    try {
        val platformModule = module {
            single { SecureKeyStore(ed25519Provider) }
            if (sshProvider != null) {
                single<SshSessionProvider> { sshProvider }
            }
        }
        startKoin {
            modules(sharedModule, iosModule, platformModule)
        }
    } catch (_: Exception) {
        // Koin already started — safe to ignore on re-entry (e.g. SwiftUI previews)
    }
}

@Throws(Exception::class)
fun getSetupViewModel(): SetupViewModel {
    return KoinPlatform.getKoin().get<SetupViewModel>()
}

@Throws(Exception::class)
fun getSetupDetector(): SetupDetector {
    return KoinPlatform.getKoin().get<SetupDetector>()
}

@Throws(Exception::class)
fun getProjectViewModel(): ProjectViewModel {
    return KoinPlatform.getKoin().get<ProjectViewModel>()
}

@Throws(Exception::class)
fun getConnectionManager(): ConnectionManager {
    return KoinPlatform.getKoin().get<ConnectionManager>()
}

@Throws(Exception::class)
fun getConnectionRepository(): ConnectionRepository {
    return KoinPlatform.getKoin().get<ConnectionRepository>()
}
