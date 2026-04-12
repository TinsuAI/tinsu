package com.tinsu.mobile.security

import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.get
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.reinterpret
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import platform.CoreFoundation.CFDictionaryCreateMutable
import platform.CoreFoundation.CFDictionaryRef
import platform.CoreFoundation.CFDictionarySetValue
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.CFTypeRefVar
import platform.CoreFoundation.kCFAllocatorDefault
import platform.Foundation.CFBridgingRetain
import platform.Foundation.NSData
import platform.Foundation.NSDate
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.NSUserDefaults
import platform.Foundation.base64EncodedStringWithOptions
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
import platform.Foundation.timeIntervalSince1970
import platform.Security.SecItemAdd
import platform.Security.SecItemDelete
import platform.Security.SecKeyCreateRandomKey
import platform.Security.SecKeyRef
import platform.Security.errSecDuplicateItem
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccessible
import platform.Security.kSecAttrAccessibleWhenUnlockedThisDeviceOnly
import platform.Security.kSecAttrApplicationTag
import platform.Security.kSecAttrKeyClass
import platform.Security.kSecAttrKeyClassPrivate
import platform.Security.kSecAttrKeySizeInBits
import platform.Security.kSecAttrKeyType
import platform.Security.kSecAttrKeyTypeEC
import platform.Security.kSecAttrKeyTypeRSA
import platform.Security.kSecAttrLabel
import platform.Security.kSecClass
import platform.Security.kSecClassKey
import platform.Security.kSecReturnData
import platform.Security.kSecValueRef

/**
 * Interface for the Swift Ed25519 CryptoKit bridge.
 * Implemented by Ed25519KeyHelper.swift in the iosApp target.
 */
interface Ed25519KeyProvider {
    fun generateAndStoreKey(alias: String): String?
    fun getPrivateKeyData(alias: String): ByteArray?
    fun deleteKey(alias: String): Boolean
}

@OptIn(ExperimentalForeignApi::class, kotlinx.cinterop.BetaInteropApi::class)
actual class SecureKeyStore(
    private val ed25519Provider: Ed25519KeyProvider? = null
) : SecureKeyStoreContract {

    private val defaults = NSUserDefaults(suiteName = DEFAULTS_SUITE)

    actual suspend fun generateKeyPair(
        alias: String,
        keyType: KeyType
    ): Result<SshKeyPair> = withContext(Dispatchers.Default) {
        if (alias.isBlank()) {
            return@withContext Result.Failure(
                AppError.KeyGenerationFailed("Alias must not be blank")
            )
        }
        try {
            when (keyType) {
                KeyType.Ed25519 -> generateEd25519(alias)
                KeyType.RSA2048 -> generateSecurityFrameworkKey(alias, keyType, 2048)
                KeyType.RSA4096 -> generateSecurityFrameworkKey(alias, keyType, 4096)
                KeyType.ECDSA_P256 -> generateSecurityFrameworkKey(alias, keyType, 256)
                KeyType.ECDSA_P384 -> generateSecurityFrameworkKey(alias, keyType, 384)
                KeyType.ECDSA_P521 -> generateSecurityFrameworkKey(alias, keyType, 521)
            }
        } catch (e: Exception) {
            Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
        }
    }

    actual suspend fun getPublicKey(alias: String): Result<String> =
        withContext(Dispatchers.Default) {
            try {
                val pubKey = defaults.stringForKey("$META_PREFIX$alias$META_SUFFIX_PUBKEY")
                if (pubKey != null) {
                    Result.Success(pubKey)
                } else {
                    Result.Failure(AppError.KeyNotFound(alias))
                }
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    actual suspend fun listKeys(): Result<List<SshKeyPair>> =
        withContext(Dispatchers.Default) {
            try {
                val aliases = getStoredAliases()
                val keys = aliases.mapNotNull { loadKeyMetadata(it) }
                Result.Success(keys)
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    actual suspend fun deleteKey(alias: String): Result<Unit> =
        withContext(Dispatchers.Default) {
            try {
                deleteKeychainKey(alias)
                ed25519Provider?.deleteKey(alias)
                clearMetadata(alias)
                Result.Success(Unit)
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    actual override suspend fun hasKey(alias: String): Result<Boolean> =
        withContext(Dispatchers.Default) {
            try {
                val exists = defaults.stringForKey("$META_PREFIX$alias$META_SUFFIX_TYPE") != null
                Result.Success(exists)
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    actual override suspend fun getKeyType(alias: String): Result<KeyType> =
        withContext(Dispatchers.Default) {
            try {
                val typeName = defaults.stringForKey("$META_PREFIX$alias$META_SUFFIX_TYPE")
                if (typeName != null) {
                    val keyType = try { KeyType.valueOf(typeName) } catch (_: IllegalArgumentException) { return@withContext Result.Failure(AppError.KeyNotFound(alias)) }
                    Result.Success(keyType)
                } else {
                    Result.Failure(AppError.KeyNotFound(alias))
                }
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    actual override suspend fun getPrivateKeyData(alias: String): Result<ByteArray> =
        withContext(Dispatchers.Default) {
            try {
                val typeName = defaults.stringForKey("$META_PREFIX$alias$META_SUFFIX_TYPE")
                if (typeName == null) {
                    return@withContext Result.Failure(AppError.KeyNotFound(alias))
                }
                val keyType = try { KeyType.valueOf(typeName) } catch (_: IllegalArgumentException) { return@withContext Result.Failure(AppError.KeyNotFound(alias)) }

                when (keyType) {
                    KeyType.Ed25519 -> {
                        // Delegate to the Swift bridge: same code that stored it retrieves it.
                        val keyData = ed25519Provider?.getPrivateKeyData(alias)
                        if (keyData != null) {
                            Result.Success(keyData)
                        } else {
                            Result.Failure(AppError.KeyNotFound(alias))
                        }
                    }
                    else -> {
                        val keyData = getSecKeyData(alias)
                        if (keyData != null) {
                            Result.Success(keyData)
                        } else {
                            Result.Failure(AppError.KeyNotFound(alias))
                        }
                    }
                }
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    @OptIn(ExperimentalForeignApi::class)
    private fun getSecKeyData(alias: String): ByteArray? = memScoped {
        val tagString = NSString.create(string = "$TAG_PREFIX$alias")
        val tagData = tagString.dataUsingEncoding(NSUTF8StringEncoding) ?: return@memScoped null

        val query = CFDictionaryCreateMutable(kCFAllocatorDefault, 4, null, null) ?: return@memScoped null
        CFDictionarySetValue(query, kSecClass, kSecClassKey)
        CFDictionarySetValue(query, kSecAttrApplicationTag, CFBridgingRetain(tagData))
        CFDictionarySetValue(query, kSecAttrKeyClass, kSecAttrKeyClassPrivate)
        CFDictionarySetValue(query, kSecReturnData, CFBridgingRetain(platform.Foundation.NSNumber(bool = true)))

        val resultRef = alloc<CFTypeRefVar>()
        val status = platform.Security.SecItemCopyMatching(query as CFDictionaryRef, resultRef.ptr.reinterpret())
        CFRelease(query)

        if (status != errSecSuccess) return@memScoped null

        val resultData = resultRef.value
        if (resultData == null) return@memScoped null

        val nsData = resultData as? NSData ?: run { CFRelease(resultData); return@memScoped null }
        val bytes = nsData.toByteArray()
        CFRelease(resultData)
        bytes
    }

    // --- Ed25519 via Swift bridge ---

    private fun generateEd25519(alias: String): Result<SshKeyPair> {
        val provider = ed25519Provider
            ?: return Result.Failure(
                AppError.KeyGenerationFailed("Ed25519 provider not configured")
            )

        val publicKeyBase64 = provider.generateAndStoreKey(alias)
            ?: return Result.Failure(
                AppError.KeyGenerationFailed("Ed25519 key generation failed via CryptoKit")
            )

        val publicKeyBytes = base64Decode(publicKeyBase64)
        val openSshKey = formatEd25519OpenSsh(publicKeyBytes)
        val createdAt = NSDate().timeIntervalSince1970.toLong() * 1000

        val sshKeyPair = SshKeyPair(
            alias = alias,
            keyType = KeyType.Ed25519,
            publicKeyOpenSshFormat = openSshKey,
            createdAt = createdAt
        )
        saveKeyMetadata(sshKeyPair)
        return Result.Success(sshKeyPair)
    }

    // --- Security Framework keys (RSA/ECDSA) ---

    private fun generateSecurityFrameworkKey(
        alias: String,
        keyType: KeyType,
        keySizeInBits: Int
    ): Result<SshKeyPair> = memScoped {
        val secKeyType = when (keyType) {
            KeyType.RSA2048, KeyType.RSA4096 -> kSecAttrKeyTypeRSA
            KeyType.ECDSA_P256, KeyType.ECDSA_P384, KeyType.ECDSA_P521 -> kSecAttrKeyTypeEC
            else -> return Result.Failure(
                AppError.KeyGenerationFailed("Unsupported key type for Security framework")
            )
        }

        val tagString = NSString.create(string = "$TAG_PREFIX$alias")
        val tagData = tagString.dataUsingEncoding(NSUTF8StringEncoding)
            ?: return Result.Failure(AppError.KeyGenerationFailed("Failed to encode tag"))

        val attributes = CFDictionaryCreateMutable(kCFAllocatorDefault, 5, null, null)
            ?: return Result.Failure(AppError.KeyGenerationFailed("Failed to create attributes"))

        try {
            CFDictionarySetValue(attributes, kSecAttrKeyType, secKeyType)
            CFDictionarySetValue(
                attributes,
                kSecAttrKeySizeInBits,
                CFBridgingRetain(platform.Foundation.NSNumber(int = keySizeInBits))
            )
            CFDictionarySetValue(
                attributes,
                kSecAttrApplicationTag,
                CFBridgingRetain(tagData)
            )
            CFDictionarySetValue(
                attributes,
                kSecAttrLabel,
                CFBridgingRetain("$LABEL_PREFIX$alias" as Any)
            )
            CFDictionarySetValue(
                attributes,
                kSecAttrAccessible,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            )

            val errorRef = alloc<CFTypeRefVar>()
            val privateKey: SecKeyRef? = SecKeyCreateRandomKey(
                attributes as CFDictionaryRef,
                errorRef.ptr.reinterpret()
            )

            if (privateKey == null) {
                errorRef.value?.let { CFRelease(it) }
                return Result.Failure(
                    AppError.KeyGenerationFailed("SecKeyCreateRandomKey failed")
                )
            }
            errorRef.value?.let { CFRelease(it) }

            val storeStatus = storeInKeychain(privateKey, alias, tagData)
            if (storeStatus != errSecSuccess && storeStatus != errSecDuplicateItem) {
                CFRelease(privateKey)
                return Result.Failure(
                    AppError.KeyGenerationFailed("Failed to store key: OSStatus $storeStatus")
                )
            }

            val publicKeyData = extractPublicKeyData(privateKey)
            CFRelease(privateKey)

            if (publicKeyData == null) {
                return Result.Failure(
                    AppError.KeyGenerationFailed("Failed to extract public key")
                )
            }

            val openSshKey = formatOpenSshPublicKey(keyType, publicKeyData)
            val createdAt = NSDate().timeIntervalSince1970.toLong() * 1000

            val sshKeyPair = SshKeyPair(
                alias = alias,
                keyType = keyType,
                publicKeyOpenSshFormat = openSshKey,
                createdAt = createdAt
            )
            saveKeyMetadata(sshKeyPair)
            Result.Success(sshKeyPair)
        } finally {
            CFRelease(attributes)
        }
    }

    private fun storeInKeychain(
        privateKey: SecKeyRef,
        alias: String,
        tagData: NSData
    ): Int = memScoped {
        val query = CFDictionaryCreateMutable(kCFAllocatorDefault, 6, null, null) ?: return -1
        try {
            CFDictionarySetValue(query, kSecClass, kSecClassKey)
            CFDictionarySetValue(query, kSecAttrKeyClass, kSecAttrKeyClassPrivate)
            CFDictionarySetValue(query, kSecValueRef, privateKey)
            CFDictionarySetValue(query, kSecAttrApplicationTag, CFBridgingRetain(tagData))
            CFDictionarySetValue(
                query,
                kSecAttrLabel,
                CFBridgingRetain("$LABEL_PREFIX$alias" as Any)
            )
            CFDictionarySetValue(
                query,
                kSecAttrAccessible,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            )
            SecItemAdd(query as CFDictionaryRef, null)
        } finally {
            CFRelease(query)
        }
    }

    private fun extractPublicKeyData(privateKey: SecKeyRef): ByteArray? = memScoped {
        val publicKey = platform.Security.SecKeyCopyPublicKey(privateKey) ?: return null
        val errorRef = alloc<CFTypeRefVar>()
        val pubKeyData = platform.Security.SecKeyCopyExternalRepresentation(
            publicKey,
            errorRef.ptr.reinterpret()
        )
        errorRef.value?.let { CFRelease(it) }
        CFRelease(publicKey)
        if (pubKeyData == null) return null

        val length = platform.CoreFoundation.CFDataGetLength(pubKeyData).toInt()
        val bytePtr = platform.CoreFoundation.CFDataGetBytePtr(pubKeyData)
        if (bytePtr == null) {
            CFRelease(pubKeyData)
            return null
        }
        val bytes = ByteArray(length) { bytePtr[it].toByte() }
        CFRelease(pubKeyData)
        bytes
    }

    // --- OpenSSH Format ---

    private fun formatOpenSshPublicKey(keyType: KeyType, publicKeyBytes: ByteArray): String {
        val keyData = when (keyType) {
            KeyType.Ed25519 -> buildSshBlob("ssh-ed25519", publicKeyBytes)
            KeyType.RSA2048, KeyType.RSA4096 -> buildRsaSshBlob(publicKeyBytes)
            KeyType.ECDSA_P256 -> buildEcdsaSshBlob("nistp256", publicKeyBytes)
            KeyType.ECDSA_P384 -> buildEcdsaSshBlob("nistp384", publicKeyBytes)
            KeyType.ECDSA_P521 -> buildEcdsaSshBlob("nistp521", publicKeyBytes)
        }
        val encoded = base64Encode(keyData)
        return "${keyType.sshKeyTypePrefix} $encoded tinsu-mobile@ios"
    }

    private fun formatEd25519OpenSsh(publicKeyBytes: ByteArray): String {
        val blob = buildSshBlob("ssh-ed25519", publicKeyBytes)
        val encoded = base64Encode(blob)
        return "ssh-ed25519 $encoded tinsu-mobile@ios"
    }

    private fun buildSshBlob(keyType: String, keyBytes: ByteArray): ByteArray {
        val typeBytes = keyType.encodeToByteArray()
        val result = ByteArray(4 + typeBytes.size + 4 + keyBytes.size)
        writeInt(result, 0, typeBytes.size)
        typeBytes.copyInto(result, 4)
        writeInt(result, 4 + typeBytes.size, keyBytes.size)
        keyBytes.copyInto(result, 4 + typeBytes.size + 4)
        return result
    }

    private fun buildRsaSshBlob(pkcs1Bytes: ByteArray): ByteArray {
        val parsed = parseRsaPkcs1(pkcs1Bytes) ?: return byteArrayOf()
        val (modulus, exponent) = parsed
        val buffer = mutableListOf<Byte>()
        appendSshString(buffer, "ssh-rsa".encodeToByteArray())
        appendSshMpInt(buffer, exponent)
        appendSshMpInt(buffer, modulus)
        return buffer.toByteArray()
    }

    private fun buildEcdsaSshBlob(curveName: String, ecPoint: ByteArray): ByteArray {
        val identifier = "ecdsa-sha2-$curveName"
        val buffer = mutableListOf<Byte>()
        appendSshString(buffer, identifier.encodeToByteArray())
        appendSshString(buffer, curveName.encodeToByteArray())
        appendSshString(buffer, ecPoint)
        return buffer.toByteArray()
    }

    // --- Byte helpers ---

    private fun writeInt(array: ByteArray, offset: Int, value: Int) {
        array[offset] = (value shr 24 and 0xFF).toByte()
        array[offset + 1] = (value shr 16 and 0xFF).toByte()
        array[offset + 2] = (value shr 8 and 0xFF).toByte()
        array[offset + 3] = (value and 0xFF).toByte()
    }

    private fun appendSshString(buffer: MutableList<Byte>, data: ByteArray) {
        val len = data.size
        buffer.add((len shr 24 and 0xFF).toByte())
        buffer.add((len shr 16 and 0xFF).toByte())
        buffer.add((len shr 8 and 0xFF).toByte())
        buffer.add((len and 0xFF).toByte())
        buffer.addAll(data.toList())
    }

    private fun appendSshMpInt(buffer: MutableList<Byte>, data: ByteArray) {
        val needsPadding = data.isNotEmpty() && (data[0].toInt() and 0x80) != 0
        val len = data.size + if (needsPadding) 1 else 0
        buffer.add((len shr 24 and 0xFF).toByte())
        buffer.add((len shr 16 and 0xFF).toByte())
        buffer.add((len shr 8 and 0xFF).toByte())
        buffer.add((len and 0xFF).toByte())
        if (needsPadding) buffer.add(0)
        buffer.addAll(data.toList())
    }

    private fun parseRsaPkcs1(data: ByteArray): Pair<ByteArray, ByteArray>? {
        if (data.size < 4) return null
        var offset = 0
        if (data[offset++] != 0x30.toByte()) return null
        offset = skipDerLength(data, offset) ?: return null

        if (offset >= data.size || data[offset++] != 0x02.toByte()) return null
        val modulusLen = readDerLength(data, offset) ?: return null
        offset = skipDerLength(data, offset) ?: return null
        if (offset + modulusLen > data.size) return null
        val modulus = data.copyOfRange(offset, offset + modulusLen)
        offset += modulusLen

        if (offset >= data.size || data[offset++] != 0x02.toByte()) return null
        val exponentLen = readDerLength(data, offset) ?: return null
        offset = skipDerLength(data, offset) ?: return null
        if (offset + exponentLen > data.size) return null
        val exponent = data.copyOfRange(offset, offset + exponentLen)

        return Pair(modulus, exponent)
    }

    private fun readDerLength(data: ByteArray, offset: Int): Int? {
        if (offset >= data.size) return null
        val first = data[offset].toInt() and 0xFF
        return if (first < 0x80) {
            first
        } else {
            val numBytes = first and 0x7F
            if (numBytes > 4 || offset + 1 + numBytes > data.size) return null
            var len = 0
            for (i in 0 until numBytes) {
                len = (len shl 8) or (data[offset + 1 + i].toInt() and 0xFF)
            }
            len
        }
    }

    private fun skipDerLength(data: ByteArray, offset: Int): Int? {
        if (offset >= data.size) return null
        val first = data[offset].toInt() and 0xFF
        return if (first < 0x80) {
            offset + 1
        } else {
            val numBytes = first and 0x7F
            if (offset + 1 + numBytes > data.size) return null
            offset + 1 + numBytes
        }
    }

    // --- Base64 helpers ---

    private fun base64Encode(data: ByteArray): String {
        if (data.isEmpty()) return ""
        val nsData = data.toNSData()
        return nsData.base64EncodedStringWithOptions(0u)
    }

    private fun base64Decode(base64: String): ByteArray {
        val nsData = NSData.create(base64EncodedString = base64, options = 0u)
            ?: return byteArrayOf()
        return nsData.toByteArray()
    }

    private fun ByteArray.toNSData(): NSData {
        if (isEmpty()) return NSData()
        return usePinned { pinned ->
            NSData.create(bytes = pinned.addressOf(0), length = size.toULong())
        }
    }

    private fun NSData.toByteArray(): ByteArray {
        val len = length.toInt()
        if (len == 0) return byteArrayOf()
        val result = ByteArray(len)
        result.usePinned { pinned ->
            platform.posix.memcpy(pinned.addressOf(0), this@toByteArray.bytes, this@toByteArray.length)
        }
        return result
    }

    // --- Metadata in NSUserDefaults (non-sensitive: alias, type, public key) ---

    private fun saveKeyMetadata(keyPair: SshKeyPair) {
        defaults.setObject(keyPair.keyType.name, "$META_PREFIX${keyPair.alias}$META_SUFFIX_TYPE")
        defaults.setObject(
            keyPair.publicKeyOpenSshFormat,
            "$META_PREFIX${keyPair.alias}$META_SUFFIX_PUBKEY"
        )
        defaults.setDouble(
            keyPair.createdAt.toDouble(),
            "$META_PREFIX${keyPair.alias}$META_SUFFIX_CREATED"
        )
        val aliases = getStoredAliases().toMutableSet()
        aliases.add(keyPair.alias)
        defaults.setObject(aliases.toList(), ALIASES_KEY)
        // synchronize() removed — deprecated since iOS 12, NSUserDefaults auto-syncs
    }

    private fun loadKeyMetadata(alias: String): SshKeyPair? {
        val typeName = defaults.stringForKey("$META_PREFIX$alias$META_SUFFIX_TYPE") ?: return null
        val pubKey = defaults.stringForKey("$META_PREFIX$alias$META_SUFFIX_PUBKEY") ?: return null
        val createdAt = defaults.doubleForKey("$META_PREFIX$alias$META_SUFFIX_CREATED").toLong()
        val keyType = try {
            KeyType.valueOf(typeName)
        } catch (_: IllegalArgumentException) {
            return null
        }
        return SshKeyPair(
            alias = alias,
            keyType = keyType,
            publicKeyOpenSshFormat = pubKey,
            createdAt = createdAt
        )
    }

    private fun getStoredAliases(): List<String> {
        return defaults.arrayForKey(ALIASES_KEY)?.filterIsInstance<String>() ?: emptyList()
    }

    private fun clearMetadata(alias: String) {
        defaults.removeObjectForKey("$META_PREFIX$alias$META_SUFFIX_TYPE")
        defaults.removeObjectForKey("$META_PREFIX$alias$META_SUFFIX_PUBKEY")
        defaults.removeObjectForKey("$META_PREFIX$alias$META_SUFFIX_CREATED")
        val aliases = getStoredAliases().toMutableSet()
        aliases.remove(alias)
        defaults.setObject(aliases.toList(), ALIASES_KEY)
        // synchronize() removed — deprecated since iOS 12, NSUserDefaults auto-syncs
    }

    private fun deleteKeychainKey(alias: String) = memScoped {
        val tagString = NSString.create(string = "$TAG_PREFIX$alias")
        val tagData = tagString.dataUsingEncoding(NSUTF8StringEncoding) ?: return@memScoped

        val query = CFDictionaryCreateMutable(kCFAllocatorDefault, 3, null, null) ?: return@memScoped
        CFDictionarySetValue(query, kSecClass, kSecClassKey)
        CFDictionarySetValue(query, kSecAttrApplicationTag, CFBridgingRetain(tagData))
        CFDictionarySetValue(
            query,
            kSecAttrLabel,
            CFBridgingRetain("$LABEL_PREFIX$alias" as Any)
        )
        SecItemDelete(query as CFDictionaryRef)
        CFRelease(query)
    }

    companion object {
        private const val LABEL_PREFIX = "com.tinsu.mobile.key."
        private const val TAG_PREFIX = "com.tinsu.mobile.ssh."
        private const val DEFAULTS_SUITE = "com.tinsu.mobile.keys"
        private const val META_PREFIX = "key_meta_"
        private const val META_SUFFIX_TYPE = "_type"
        private const val META_SUFFIX_PUBKEY = "_pubkey"
        private const val META_SUFFIX_CREATED = "_created"
        private const val ALIASES_KEY = "stored_key_aliases"
    }
}
