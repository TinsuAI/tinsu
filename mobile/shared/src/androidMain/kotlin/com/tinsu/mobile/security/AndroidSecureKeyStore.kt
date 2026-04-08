package com.tinsu.mobile.security

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.spec.ECGenParameterSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

actual class SecureKeyStore(private val context: Context) : SecureKeyStoreContract {

    private val androidKeyStore: KeyStore by lazy {
        KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    }

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
            val keyPair = when (keyType) {
                KeyType.Ed25519 -> generateEd25519(alias)
                KeyType.RSA2048 -> generateRsa(alias, 2048)
                KeyType.RSA4096 -> generateRsa(alias, 4096)
                KeyType.ECDSA_P256 -> generateEcdsa(alias, "secp256r1")
                KeyType.ECDSA_P384 -> generateEcdsa(alias, "secp384r1")
                KeyType.ECDSA_P521 -> generateEcdsa(alias, "secp521r1")
            }
            val publicKeyBytes = keyPair.public.encoded
            val openSshKey = formatOpenSshPublicKey(keyType, publicKeyBytes)
            val sshKeyPair = SshKeyPair(
                alias = alias,
                keyType = keyType,
                publicKeyOpenSshFormat = openSshKey,
                createdAt = System.currentTimeMillis()
            )
            saveKeyMetadata(sshKeyPair)
            Result.Success(sshKeyPair)
        } catch (e: Exception) {
            Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
        }
    }

    actual suspend fun getPublicKey(alias: String): Result<String> =
        withContext(Dispatchers.Default) {
            try {
                val metadata = loadKeyMetadata(alias)
                if (metadata != null) {
                    Result.Success(metadata.publicKeyOpenSshFormat)
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
                val prefs = getEncryptedPrefs()
                val keys = prefs.all.keys
                    .filter { it.startsWith(META_PREFIX) && it.endsWith(META_SUFFIX_TYPE) }
                    .mapNotNull { key ->
                        val alias = key.removePrefix(META_PREFIX).removeSuffix(META_SUFFIX_TYPE)
                        loadKeyMetadata(alias)
                    }
                Result.Success(keys)
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    actual suspend fun deleteKey(alias: String): Result<Unit> =
        withContext(Dispatchers.Default) {
            try {
                // Delete from Android Keystore
                if (androidKeyStore.containsAlias(alias)) {
                    androidKeyStore.deleteEntry(alias)
                }
                // Delete Ed25519 fallback key if present
                if (androidKeyStore.containsAlias(ed25519FallbackAlias(alias))) {
                    androidKeyStore.deleteEntry(ed25519FallbackAlias(alias))
                }
                // Delete from EncryptedSharedPreferences (fallback key material + metadata)
                val prefs = getEncryptedPrefs()
                prefs.edit()
                    .remove(ed25519FallbackKey(alias))
                    .remove("$META_PREFIX$alias$META_SUFFIX_TYPE")
                    .remove("$META_PREFIX$alias$META_SUFFIX_PUBKEY")
                    .remove("$META_PREFIX$alias$META_SUFFIX_CREATED")
                    .apply()
                Result.Success(Unit)
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    actual override suspend fun hasKey(alias: String): Result<Boolean> =
        withContext(Dispatchers.Default) {
            try {
                val metadata = loadKeyMetadata(alias)
                Result.Success(metadata != null)
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    actual override suspend fun getKeyType(alias: String): Result<KeyType> =
        withContext(Dispatchers.Default) {
            try {
                val metadata = loadKeyMetadata(alias)
                if (metadata != null) {
                    Result.Success(metadata.keyType)
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
                val metadata = loadKeyMetadata(alias)
                    ?: return@withContext Result.Failure(AppError.KeyNotFound(alias))

                val keyBytes = when (metadata.keyType) {
                    KeyType.Ed25519 -> getEd25519PrivateKeyBytes(alias)
                    else -> getPrivateKeyFromAndroidKeyStore(alias)
                }
                if (keyBytes != null) {
                    Result.Success(keyBytes)
                } else {
                    Result.Failure(AppError.KeyNotFound(alias))
                }
            } catch (e: Exception) {
                Result.Failure(AppError.KeyGenerationFailed(e.message ?: "Unknown error"))
            }
        }

    private fun getEd25519PrivateKeyBytes(alias: String): ByteArray? {
        val prefs = getEncryptedPrefs()
        val base64 = prefs.getString(ed25519FallbackKey(alias), null) ?: return null
        return Base64.decode(base64, Base64.NO_WRAP)
    }

    private fun getPrivateKeyFromAndroidKeyStore(alias: String): ByteArray? {
        val entry = androidKeyStore.getEntry(alias, null) as? KeyStore.PrivateKeyEntry
            ?: return null
        return entry.privateKey.encoded
    }

    // --- Key Generation ---

    private fun generateEd25519(alias: String): java.security.KeyPair {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            generateEd25519Native(alias)
        } else {
            generateEd25519Fallback(alias)
        }
    }

    @Suppress("NewApi")
    private fun generateEd25519Native(alias: String): java.security.KeyPair {
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        ).build()
        val kpg = KeyPairGenerator.getInstance("Ed25519", ANDROID_KEYSTORE)
        kpg.initialize(spec)
        return kpg.generateKeyPair()
    }

    private fun generateEd25519Fallback(alias: String): java.security.KeyPair {
        // Use Bouncy Castle for Ed25519 on API 29-32
        val kpg = KeyPairGenerator.getInstance(
            "Ed25519",
            org.bouncycastle.jce.provider.BouncyCastleProvider()
        )
        val keyPair = kpg.generateKeyPair()

        // Store private key bytes in EncryptedSharedPreferences
        val privateKeyBytes = keyPair.private.encoded
        val prefs = getEncryptedPrefs()
        prefs.edit()
            .putString(
                ed25519FallbackKey(alias),
                Base64.encodeToString(privateKeyBytes, Base64.NO_WRAP)
            )
            .apply()

        return keyPair
    }

    private fun generateRsa(alias: String, keySize: Int): java.security.KeyPair {
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setKeySize(keySize)
            .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA512)
            .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
            .build()
        val kpg = KeyPairGenerator.getInstance("RSA", ANDROID_KEYSTORE)
        kpg.initialize(spec)
        return kpg.generateKeyPair()
    }

    private fun generateEcdsa(alias: String, curveName: String): java.security.KeyPair {
        val ecSpec = ECGenParameterSpec(curveName)
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setAlgorithmParameterSpec(ecSpec)
            .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA384, KeyProperties.DIGEST_SHA512)
            .build()
        val kpg = KeyPairGenerator.getInstance("EC", ANDROID_KEYSTORE)
        kpg.initialize(spec)
        return kpg.generateKeyPair()
    }

    // --- OpenSSH Format Encoding ---

    private fun formatOpenSshPublicKey(keyType: KeyType, publicKeyBytes: ByteArray): String {
        val keyData = when (keyType) {
            KeyType.Ed25519 -> encodeEd25519OpenSsh(publicKeyBytes)
            KeyType.RSA2048, KeyType.RSA4096 -> encodeRsaOpenSsh(publicKeyBytes)
            KeyType.ECDSA_P256 -> encodeEcdsaOpenSsh("nistp256", publicKeyBytes)
            KeyType.ECDSA_P384 -> encodeEcdsaOpenSsh("nistp384", publicKeyBytes)
            KeyType.ECDSA_P521 -> encodeEcdsaOpenSsh("nistp521", publicKeyBytes)
        }
        val encoded = Base64.encodeToString(keyData, Base64.NO_WRAP)
        return "${keyType.sshKeyTypePrefix} $encoded tinsu-mobile@android"
    }

    private fun encodeEd25519OpenSsh(publicKeyBytes: ByteArray): ByteArray {
        // Ed25519 public keys from JCA are typically in X.509 SubjectPublicKeyInfo format
        // Extract the raw 32-byte key from the end
        val rawKey = if (publicKeyBytes.size > 32) {
            publicKeyBytes.copyOfRange(publicKeyBytes.size - 32, publicKeyBytes.size)
        } else {
            publicKeyBytes
        }
        return buildOpenSshBlob("ssh-ed25519", rawKey)
    }

    private fun encodeRsaOpenSsh(publicKeyBytes: ByteArray): ByteArray {
        // Parse X.509 encoded RSA public key
        val keyFactory = java.security.KeyFactory.getInstance("RSA")
        val pubKey = keyFactory.generatePublic(
            java.security.spec.X509EncodedKeySpec(publicKeyBytes)
        ) as java.security.interfaces.RSAPublicKey

        val baos = ByteArrayOutputStream()
        val dos = DataOutputStream(baos)
        writeString(dos, "ssh-rsa")
        writeMpInt(dos, pubKey.publicExponent)
        writeMpInt(dos, pubKey.modulus)
        return baos.toByteArray()
    }

    private fun encodeEcdsaOpenSsh(curveName: String, publicKeyBytes: ByteArray): ByteArray {
        // Parse X.509 encoded EC public key
        val keyFactory = java.security.KeyFactory.getInstance("EC")
        val pubKey = keyFactory.generatePublic(
            java.security.spec.X509EncodedKeySpec(publicKeyBytes)
        ) as java.security.interfaces.ECPublicKey

        val point = pubKey.w
        val fieldSize = when (curveName) {
            "nistp256" -> 32
            "nistp384" -> 48
            "nistp521" -> 66
            else -> throw IllegalArgumentException("Unsupported curve: $curveName")
        }

        // Uncompressed point format: 0x04 || X || Y
        val x = point.affineX.toByteArray().let { padOrTrim(it, fieldSize) }
        val y = point.affineY.toByteArray().let { padOrTrim(it, fieldSize) }
        val ecPoint = ByteArray(1 + fieldSize * 2)
        ecPoint[0] = 0x04
        x.copyInto(ecPoint, 1)
        y.copyInto(ecPoint, 1 + fieldSize)

        val identifier = "ecdsa-sha2-$curveName"
        val baos = ByteArrayOutputStream()
        val dos = DataOutputStream(baos)
        writeString(dos, identifier)
        writeString(dos, curveName)
        writeBytes(dos, ecPoint)
        return baos.toByteArray()
    }

    private fun buildOpenSshBlob(keyType: String, rawKey: ByteArray): ByteArray {
        val baos = ByteArrayOutputStream()
        val dos = DataOutputStream(baos)
        writeString(dos, keyType)
        writeBytes(dos, rawKey)
        return baos.toByteArray()
    }

    private fun writeString(dos: DataOutputStream, s: String) {
        val bytes = s.toByteArray(Charsets.UTF_8)
        dos.writeInt(bytes.size)
        dos.write(bytes)
    }

    private fun writeBytes(dos: DataOutputStream, bytes: ByteArray) {
        dos.writeInt(bytes.size)
        dos.write(bytes)
    }

    private fun writeMpInt(dos: DataOutputStream, value: java.math.BigInteger) {
        var bytes = value.toByteArray()
        // Remove leading zero if present and unnecessary
        if (bytes.size > 1 && bytes[0] == 0.toByte() && (bytes[1].toInt() and 0x80) == 0) {
            bytes = bytes.copyOfRange(1, bytes.size)
        }
        writeBytes(dos, bytes)
    }

    private fun padOrTrim(bytes: ByteArray, size: Int): ByteArray {
        return when {
            bytes.size == size -> bytes
            bytes.size > size -> {
                // Remove leading zeros
                val start = bytes.size - size
                bytes.copyOfRange(start, bytes.size)
            }
            else -> {
                // Pad with leading zeros
                val padded = ByteArray(size)
                bytes.copyInto(padded, size - bytes.size)
                padded
            }
        }
    }

    // --- Metadata Storage ---

    private fun getEncryptedPrefs(): android.content.SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun saveKeyMetadata(keyPair: SshKeyPair) {
        val prefs = getEncryptedPrefs()
        prefs.edit()
            .putString("$META_PREFIX${keyPair.alias}$META_SUFFIX_TYPE", keyPair.keyType.name)
            .putString(
                "$META_PREFIX${keyPair.alias}$META_SUFFIX_PUBKEY",
                keyPair.publicKeyOpenSshFormat
            )
            .putLong("$META_PREFIX${keyPair.alias}$META_SUFFIX_CREATED", keyPair.createdAt)
            .apply()
    }

    private fun loadKeyMetadata(alias: String): SshKeyPair? {
        val prefs = getEncryptedPrefs()
        val typeName = prefs.getString("$META_PREFIX$alias$META_SUFFIX_TYPE", null)
            ?: return null
        val pubKey = prefs.getString("$META_PREFIX$alias$META_SUFFIX_PUBKEY", null)
            ?: return null
        val createdAt = prefs.getLong("$META_PREFIX$alias$META_SUFFIX_CREATED", 0L)
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

    private fun ed25519FallbackAlias(alias: String) = "${alias}_ed25519_wrapper"
    private fun ed25519FallbackKey(alias: String) = "${ED25519_FALLBACK_PREFIX}$alias"

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val PREFS_FILE = "tinsu_secure_keys"
        private const val META_PREFIX = "key_meta_"
        private const val META_SUFFIX_TYPE = "_type"
        private const val META_SUFFIX_PUBKEY = "_pubkey"
        private const val META_SUFFIX_CREATED = "_created"
        private const val ED25519_FALLBACK_PREFIX = "ed25519_priv_"
    }
}
