package com.tinsu.mobile.di

import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.tinsu.mobile.db.TinsuMobile
import org.koin.dsl.module

val androidModule = module {
    single<SqlDriver> {
        AndroidSqliteDriver(TinsuMobile.Schema, get(), "tinsu-mobile.db")
    }
}
