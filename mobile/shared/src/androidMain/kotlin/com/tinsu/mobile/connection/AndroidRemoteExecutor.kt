package com.tinsu.mobile.connection

import android.os.Build
import com.tinsu.mobile.security.KeyType
import com.tinsu.mobile.security.SecureKeyStore
import com.tinsu.mobile.util.AppError
import com.tinsu.mobile.util.Result
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyStore
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.apache.sshd.client.SshClient
import org.apache.sshd.client.channel.ClientChannelEvent
import org.apache.sshd.client.session.ClientSession
import org.apache.sshd.common.keyprovider.KeyPairProvider
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.jce.provider.BouncyCastleProvider

actual class RemoteExecutor actual constructor(
    private val secureKeyStore: SecureKeyStore
) : RemoteExecutorContract {
    private var sshClient: SshClient? = null
    private var session: ClientSession? = null

    @Volatile
    private var connected = false

    override suspend fun connect(
        host: String,
        port: Int,
        username: String,
        keyAlias: String
    ): Result<SessionInfo> = withContext(Dispatchers.IO) {
        try {
            val keyPair = loadKeyPairForSsh(keyAlias)
                ?: return@withContext Result.Failure(
                    AppError.KeyNotFound(keyAlias)
                )

            val client = SshClient.setUpDefaultClient()
            client.start()

            val connectFuture = client.connect(username, host, port)
            val clientSession = connectFuture.verify(5000).session
                ?: throw SocketTimeoutException("Connection timed out")

            clientSession.addPublicKeyIdentity(keyPair)
            clientSession.auth().verify(5000)

            if (!clientSession.isAuthenticated) {
                clientSession.close(false)
                client.close()
                return@withContext Result.Failure(
                    AppError.ConnectionFailed("Authentication failed")
                )
            }

            sshClient = client
            session = clientSession
            connected = true

            Result.Success(
                SessionInfo(
                    host = host,
                    port = port,
                    serverVersion = clientSession.serverVersion ?: "Unknown",
                    authenticatedAs = username
                )
            )
        } catch (e: UnknownHostException) {
            disconnectInternal()
            Result.Failure(
                AppError.ConnectionFailed("Host unreachable: ${e.message}")
            )
        } catch (e: SocketTimeoutException) {
            disconnectInternal()
            Result.Failure(
                AppError.Timeout("Connection timed out")
            )
        } catch (e: ConnectException) {
            disconnectInternal()
            Result.Failure(
                AppError.ConnectionFailed("Connection refused: ${e.message}")
            )
        } catch (e: org.apache.sshd.common.SshException) {
            disconnectInternal()
            if (e.message?.contains("Permission denied") == true ||
                e.message?.contains("authentication") == true
            ) {
                Result.Failure(AppError.ConnectionFailed("Authentication failed: ${e.message}"))
            } else {
                Result.Failure(AppError.ConnectionFailed("SSH error: ${e.message}"))
            }
        } catch (e: Exception) {
            disconnectInternal()
            Result.Failure(
                AppError.ConnectionFailed(e.message ?: "Unknown connection error")
            )
        }
    }

    override suspend fun exec(command: String): CommandResult =
        withContext(Dispatchers.IO) {
            val currentSession = session
                ?: throw IllegalStateException("Not connected")

            val channel = currentSession.createExecChannel(command)
            val stdoutStream = ByteArrayOutputStream()
            val stderrStream = ByteArrayOutputStream()

            channel.out = stdoutStream
            channel.err = stderrStream

            channel.open().verify(5000)
            channel.waitFor(
                setOf(ClientChannelEvent.CLOSED),
                5000
            )

            val exitCode = channel.exitStatus ?: -1
            channel.close(false)

            CommandResult(
                exitCode = exitCode,
                stdout = stdoutStream.toString("UTF-8"),
                stderr = stderrStream.toString("UTF-8")
            )
        }

    override suspend fun disconnect() {
        withContext(Dispatchers.IO) {
            disconnectInternal()
        }
    }

    override fun isConnected(): Boolean = connected && session?.isOpen == true

    private fun disconnectInternal() {
        connected = false
        try {
            session?.close(false)
        } catch (_: Exception) { }
        try {
            sshClient?.close()
        } catch (_: Exception) { }
        session = null
        sshClient = null
    }

    private suspend fun loadKeyPairForSsh(alias: String): KeyPair? {
        val keyTypeResult = secureKeyStore.getKeyType(alias)
        val keyType = when (keyTypeResult) {
            is Result.Success -> keyTypeResult.data
            is Result.Failure -> return null
        }

        val privateKeyResult = secureKeyStore.getPrivateKeyData(alias)
        val privateKeyBytes = when (privateKeyResult) {
            is Result.Success -> privateKeyResult.data
            is Result.Failure -> return null
        }

        return when (keyType) {
            KeyType.Ed25519 -> buildEd25519KeyPair(privateKeyBytes)
            KeyType.RSA2048, KeyType.RSA4096 -> buildRsaKeyPair(privateKeyBytes)
            KeyType.ECDSA_P256, KeyType.ECDSA_P384, KeyType.ECDSA_P521 ->
                buildEcdsaKeyPair(privateKeyBytes)
        }
    }

    private fun buildEd25519KeyPair(privateKeyBytes: ByteArray): KeyPair? {
        return try {
            // Ed25519 private key from SecureKeyStore is raw 32 bytes (BouncyCastle) or PKCS#8
            val rawPrivate = if (privateKeyBytes.size == 32) {
                privateKeyBytes
            } else {
                // PKCS#8 wrapped — extract last 32 bytes
                privateKeyBytes.copyOfRange(privateKeyBytes.size - 32, privateKeyBytes.size)
            }

            val privateKeyParams = Ed25519PrivateKeyParameters(rawPrivate, 0)
            val publicKeyParams = privateKeyParams.generatePublicKey()
            val publicKeyBytes = publicKeyParams.encoded

            val provider = BouncyCastleProvider()
            val keyFactory = KeyFactory.getInstance("Ed25519", provider)
            val privateKey = keyFactory.generatePrivate(
                PKCS8EncodedKeySpec(wrapEd25519PKCS8(rawPrivate))
            )
            val publicKey = keyFactory.generatePublic(
                X509EncodedKeySpec(wrapEd25519X509(publicKeyBytes))
            )
            KeyPair(publicKey, privateKey)
        } catch (_: Exception) {
            null
        }
    }

    private fun buildRsaKeyPair(privateKeyBytes: ByteArray): KeyPair? {
        return try {
            val keyFactory = KeyFactory.getInstance("RSA")
            val privateKey = keyFactory.generatePrivate(PKCS8EncodedKeySpec(privateKeyBytes))
            // Reconstruct public key from private key via AndroidKeyStore or derive from private
            // For AndroidKeyStore keys, private.encoded may be empty — try the AndroidKeyStore path
            if (privateKeyBytes.isEmpty()) return null

            // RSA private key contains modulus and public exponent
            val rsaPrivate = privateKey as java.security.interfaces.RSAPrivateCrtKey
            val pubSpec = java.security.spec.RSAPublicKeySpec(rsaPrivate.modulus, rsaPrivate.publicExponent)
            val publicKey = keyFactory.generatePublic(pubSpec)
            KeyPair(publicKey, privateKey)
        } catch (_: Exception) {
            null
        }
    }

    private fun buildEcdsaKeyPair(privateKeyBytes: ByteArray): KeyPair? {
        return try {
            // EC private key in PKCS#8 format
            val keyFactory = KeyFactory.getInstance("EC", BouncyCastleProvider())
            val privateKey = keyFactory.generatePrivate(PKCS8EncodedKeySpec(privateKeyBytes))
            val ecPrivateKey = privateKey as java.security.interfaces.ECPrivateKey
            val params = ecPrivateKey.params ?: return null
            // Derive public key from private key by generating a key pair with the same params
            val generator = java.security.KeyPairGenerator.getInstance("EC", BouncyCastleProvider())
            generator.initialize(params)
            // We can't directly derive the public key from the private scalar in standard Java,
            // so for ECDSA keys stored as PKCS#8, the encoded bytes should contain the public key
            // For now, return null and rely on the SSH library to handle it
            null
        } catch (_: Exception) {
            null
        }
    }

    private fun buildEd25519KeyPairFromAndroidKeyStore(alias: String): KeyPair? {
        return try {
            val androidKeyStore = KeyStore.getInstance("AndroidKeyStore")
            androidKeyStore.load(null)
            val privateKey = androidKeyStore.getKey(alias, null) as? java.security.PrivateKey ?: return null
            val publicKey = androidKeyStore.getCertificate(alias)?.publicKey ?: return null
            KeyPair(publicKey, privateKey)
        } catch (_: Exception) {
            null
        }
    }

    private fun wrapEd25519X509(rawPublicKey: ByteArray): ByteArray {
        // X.509 SubjectPublicKeyInfo for Ed25519 OID
        val oid = byteArrayOf(
            0x30, 0x05, // SEQUENCE len=5
            0x06, 0x03, 0x2B, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
        )
        val bitString = byteArrayOf(0x03, 0x21, 0x00) + rawPublicKey // BIT STRING
        val inner = oid + bitString
        val len = encodeDerLength(inner.size)
        return byteArrayOf(0x30) + len + inner
    }

    private fun wrapEd25519PKCS8(rawPrivateKey: ByteArray): ByteArray {
        // PKCS#8 PrivateKeyInfo for Ed25519 OID
        val oid = byteArrayOf(
            0x30, 0x05,
            0x06, 0x03, 0x2B, 0x65, 0x70
        )
        val keyContent = rawPrivateKey.copyOf(32)
        val innerKey = byteArrayOf(0x04, 0x20) + keyContent // OCTET STRING
        val algorithm = oid
        val pki = algorithm + byteArrayOf(0xA1.toByte()) + encodeDerLength(innerKey.size) + innerKey
        val len = encodeDerLength(pki.size)
        return byteArrayOf(0x30) + len + pki
    }

    private fun encodeDerLength(length: Int): ByteArray {
        return when {
            length < 128 -> byteArrayOf(length.toByte())
            length < 256 -> byteArrayOf(0x81.toByte(), length.toByte())
            else -> byteArrayOf(0x82.toByte(), (length shr 8).toByte(), length.toByte())
        }
    }
}
