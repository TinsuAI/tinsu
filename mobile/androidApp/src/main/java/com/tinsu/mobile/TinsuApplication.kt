package com.tinsu.mobile

import android.app.Application
import com.tinsu.mobile.di.androidModule
import com.tinsu.mobile.di.sharedModule
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

class TinsuApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@TinsuApplication)
            modules(sharedModule, androidModule)
        }
    }
}
