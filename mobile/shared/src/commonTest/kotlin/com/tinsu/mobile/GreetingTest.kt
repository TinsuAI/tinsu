package com.tinsu.mobile

import kotlin.test.Test
import kotlin.test.assertTrue

class GreetingTest {
    @Test
    fun greetingContainsTinSuMobile() {
        val greeting = Greeting().greet()
        assertTrue(greeting.contains("TinSu Mobile"), "Greeting should contain 'TinSu Mobile'")
    }
}
