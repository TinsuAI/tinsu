package com.tinsu.mobile.di

import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.ConnectionTester
import com.tinsu.mobile.connection.RemoteExecutor
import com.tinsu.mobile.connection.RemoteExecutorContract
import com.tinsu.mobile.connection.createConnectionRepository
import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.security.SecureKeyStore
import com.tinsu.mobile.security.SecureKeyStoreContract
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val androidModule = module {
    single<SqlDriver> {
        AndroidSqliteDriver(TinsuMobile.Schema, get(), "tinsu-mobile.db")
    }
    single { SecureKeyStore(androidContext()) }
    single<SecureKeyStoreContract> { get<SecureKeyStore>() }
    single<ConnectionRepository> { createConnectionRepository(get()) }
    single<RemoteExecutorContract> { RemoteExecutor(get()) }
    single { ConnectionTester(get(), get()) }
}
