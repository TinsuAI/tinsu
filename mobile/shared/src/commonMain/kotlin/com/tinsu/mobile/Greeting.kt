package com.tinsu.mobile

class Greeting {
    private val platform = getPlatform()

    fun greet(): String {
        return "TinSu Mobile — ${platform.name}"
    }
}
