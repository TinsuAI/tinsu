import Foundation
import CryptoKit
import NIOCore
import Citadel
import Shared

// MARK: - KotlinByteArray → Data helper

private extension KotlinByteArray {
    func toData() -> Data {
        let count = Int(size)
        var bytes = [UInt8](repeating: 0, count: count)
        for i in 0..<count {
            bytes[i] = UInt8(bitPattern: get(index: Int32(i)))
        }
        return Data(bytes)
    }
}

// MARK: - Thread-safe box for async→sync bridge

private final class Box<T> {
    var value: T
    init(_ value: T) { self.value = value }
}

// MARK: - SshProvider

/// Full SSH provider using Citadel (SwiftNIO SSH).
/// Bridges async/await Citadel calls to the synchronous SshSessionProvider protocol
/// expected by the Kotlin/Native interop layer.
final class SshProvider: NSObject, SshSessionProvider {

    private var client: SSHClient?

    // MARK: - Key-based connect (Ed25519)

    func connect(
        host: String,
        port: Int32,
        username: String,
        privateKeyData: KotlinByteArray,
        keyType: String
    ) -> SshBridgeResult {
        let sema = DispatchSemaphore(value: 0)
        let box = Box(SshBridgeResult(success: false, serverVersion: "", errorMessage: "Unknown"))

        Task {
            do {
                guard keyType == "Ed25519" else {
                    box.value = SshBridgeResult(
                        success: false,
                        serverVersion: "",
                        errorMessage: "Unsupported key type: \(keyType). Only Ed25519 is supported."
                    )
                    sema.signal()
                    return
                }
                let keyData = privateKeyData.toData()
                let privateKey = try Curve25519.Signing.PrivateKey(rawRepresentation: keyData)
                let c = try await SSHClient.connect(
                    host: host,
                    port: Int(port),
                    authenticationMethod: .ed25519(username: username, privateKey: privateKey),
                    hostKeyValidator: .acceptAnything(),
                    reconnect: .never
                )
                self.client = c
                box.value = SshBridgeResult(success: true, serverVersion: "", errorMessage: "")
            } catch {
                box.value = SshBridgeResult(
                    success: false,
                    serverVersion: "",
                    errorMessage: error.localizedDescription
                )
            }
            sema.signal()
        }

        sema.wait()
        return box.value
    }

    // MARK: - Password-based connect (for key deployment)

    func connectWithPassword(
        host: String,
        port: Int32,
        username: String,
        password: String
    ) -> SshBridgeResult {
        let sema = DispatchSemaphore(value: 0)
        let box = Box(SshBridgeResult(success: false, serverVersion: "", errorMessage: "Unknown"))

        Task {
            do {
                let c = try await SSHClient.connect(
                    host: host,
                    port: Int(port),
                    authenticationMethod: .passwordBased(username: username, password: password),
                    hostKeyValidator: .acceptAnything(),
                    reconnect: .never
                )
                self.client = c
                box.value = SshBridgeResult(success: true, serverVersion: "", errorMessage: "")
            } catch {
                box.value = SshBridgeResult(
                    success: false,
                    serverVersion: "",
                    errorMessage: error.localizedDescription
                )
            }
            sema.signal()
        }

        sema.wait()
        return box.value
    }

    // MARK: - Execute command

    func exec(command: String) -> SshBridgeExecResult {
        guard let c = client else {
            return SshBridgeExecResult(exitCode: -1, stdout: "", stderr: "Not connected")
        }

        let sema = DispatchSemaphore(value: 0)
        let box = Box(SshBridgeExecResult(exitCode: -1, stdout: "", stderr: "Unknown"))

        Task {
            do {
                // Wrap in sh -c and append exit-code sentinel so we can reliably
                // detect failure even when Citadel swallows the SSH exit-status.
                let wrapped = "sh -c \(shellEscape(command)); echo \"__EXIT:$?\""
                let output = try await c.executeCommand(wrapped)
                let raw = output.getString(at: output.readerIndex, length: output.readableBytes) ?? ""

                // Parse sentinel from the last line.
                let lines = raw.components(separatedBy: "\n")
                var exitCode: Int32 = 0
                var stdoutLines = lines
                if let last = lines.last(where: { $0.hasPrefix("__EXIT:") }),
                   let code = Int32(last.dropFirst("__EXIT:".count).trimmingCharacters(in: .whitespaces)) {
                    exitCode = code
                    stdoutLines = lines.filter { !$0.hasPrefix("__EXIT:") }
                }
                let stdout = stdoutLines.joined(separator: "\n")
                box.value = SshBridgeExecResult(exitCode: exitCode, stdout: stdout, stderr: "")
            } catch {
                box.value = SshBridgeExecResult(
                    exitCode: -1,
                    stdout: "",
                    stderr: error.localizedDescription
                )
            }
            sema.signal()
        }

        sema.wait()
        return box.value
    }

    // MARK: - Helpers

    /// Wraps a command string in single quotes, escaping any embedded single quotes.
    private func shellEscape(_ command: String) -> String {
        "'" + command.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    // MARK: - Disconnect

    func disconnect() {
        let c = client
        client = nil
        Task { try? await c?.close() }
    }

    // MARK: - Connection state

    func isConnected() -> Bool {
        return client != nil
    }
}
