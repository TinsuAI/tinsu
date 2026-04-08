package com.tinsu.mobile.di

import com.tinsu.mobile.connection.ConnectionListViewModel
import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.connection.ConnectionTester
import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.setup.SetupDetector
import com.tinsu.mobile.setup.SetupViewModel
import org.koin.dsl.module

val sharedModule = module {
    single { TinsuMobile(get()) }
    factory { ConnectionListViewModel(get(), getOrNull()) }
    single { SetupDetector(get(), get()) }
    factory { SetupViewModel(get(), get(), get(), get()) }
}
