package com.tinsu.mobile.di

import org.koin.dsl.module

val iosModule = module {
    // Future: single<SqlDriver> { NativeSqliteDriver(TinsuMobile.Schema, "tinsu-mobile.db") }
}
