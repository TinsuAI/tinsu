package com.tinsu.mobile.setup

interface SetupNavigator {
    fun navigateToConnectionList()
    fun navigateToStep(step: SetupStep)
}
