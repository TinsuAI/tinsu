package com.tinsu.mobile.di

import org.koin.dsl.module

val androidModule = module {
    // Future: single<SqlDriver> { AndroidSqliteDriver(TinsuMobile.Schema, get(), "tinsu-mobile.db") }
}
