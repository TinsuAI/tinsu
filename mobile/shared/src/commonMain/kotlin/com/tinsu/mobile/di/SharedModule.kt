package com.tinsu.mobile.di

import com.tinsu.mobile.db.TinsuMobile
import org.koin.dsl.module

val sharedModule = module {
    single { TinsuMobile(get()) }
}
