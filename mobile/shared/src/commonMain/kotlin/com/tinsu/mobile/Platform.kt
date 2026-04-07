package com.tinsu.mobile

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform
