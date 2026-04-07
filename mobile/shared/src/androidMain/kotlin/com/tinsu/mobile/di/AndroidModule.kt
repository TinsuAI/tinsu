package com.tinsu.mobile.di

import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.security.SecureKeyStore
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val androidModule = module {
    single<SqlDriver> {
        AndroidSqliteDriver(TinsuMobile.Schema, get(), "tinsu-mobile.db")
    }
    single { SecureKeyStore(androidContext()) }
}
