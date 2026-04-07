package com.tinsu.mobile.di

import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.native.NativeSqliteDriver
import com.tinsu.mobile.db.TinsuMobile
import org.koin.dsl.module

val iosModule = module {
    single<SqlDriver> {
        NativeSqliteDriver(TinsuMobile.Schema, "tinsu-mobile.db")
    }
}
