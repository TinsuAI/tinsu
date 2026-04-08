package com.tinsu.mobile.connection

data class SessionInfo(
    val host: String,
    val port: Int,
    val serverVersion: String,
    val authenticatedAs: String
)
