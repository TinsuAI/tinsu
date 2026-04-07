package com.tinsu.mobile.security

data class SshKeyPair(
    val alias: String,
    val keyType: KeyType,
    val publicKeyOpenSshFormat: String,
    val createdAt: Long
)
