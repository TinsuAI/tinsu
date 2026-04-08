package com.tinsu.mobile.di

import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.native.NativeSqliteDriver
import com.tinsu.mobile.connection.ConnectionManager
import com.tinsu.mobile.connection.ConnectionManagerImpl
import com.tinsu.mobile.connection.ConnectionMonitor
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.ConnectionTester
import com.tinsu.mobile.connection.RemoteExecutor
import com.tinsu.mobile.connection.RemoteExecutorContract
import com.tinsu.mobile.connection.createConnectionRepository
import com.tinsu.mobile.connection.createRemoteExecutor
import com.tinsu.mobile.connection.SshSessionProvider
import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.security.SecureKeyStore
import com.tinsu.mobile.security.SecureKeyStoreContract
import com.tinsu.mobile.util.HapticFeedback
import org.koin.dsl.module

val iosModule = module {
    single<SqlDriver> {
        NativeSqliteDriver(TinsuMobile.Schema, "tinsu-mobile.db")
    }
    single<SecureKeyStoreContract> { get<SecureKeyStore>() }
    single<ConnectionRepository> { createConnectionRepository(get()) }
    single<RemoteExecutorContract> { createRemoteExecutor(get(), getOrNull()) }
    single { ConnectionTester(get(), get()) }
    single { HapticFeedback.create() }
    single<ConnectionManager> { ConnectionManagerImpl(get(), get(), get()) }
    single { ConnectionMonitor(get(), get()) }
}
