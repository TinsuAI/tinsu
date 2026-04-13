import SwiftUI
import Shared

/// SwiftUI view for creating/editing a connection matching Android design.
struct ConnectionEditScreen: View {
    let existingConnection: ConnectionConfig?
    let repository: ConnectionRepository
    let viewModel: ConnectionListViewModel
    let onSave: () -> Void

    @State private var displayName: String
    @State private var host: String
    @State private var port: String
    @State private var username: String
    @State private var transportType: TransportType
    @State private var sshKeyAlias: String

    @State private var displayNameError: String?
    @State private var hostError: String?
    @State private var usernameError: String?
    @State private var portError: String?
    @State private var generalError: String?

    @State private var testState: ConnectionTestState = .idle
    @State private var isTested: Bool = false

    @Environment(\.dismiss) private var dismiss

    var isEditing: Bool { existingConnection != nil }

    /// State key matching the ViewModel's key logic
    private var stateKey: String {
        existingConnection?.id ?? "__new_\(host)_\(port)"
    }

    var canSave: Bool { isEditing || isTested }

    init(
        existingConnection: ConnectionConfig?,
        repository: ConnectionRepository,
        viewModel: ConnectionListViewModel,
        onSave: @escaping () -> Void
    ) {
        self.existingConnection = existingConnection
        self.repository = repository
        self.viewModel = viewModel
        self.onSave = onSave

        _displayName = State(initialValue: existingConnection?.displayName ?? "")
        _host = State(initialValue: existingConnection?.host ?? "")
        _port = State(initialValue: existingConnection?.port.description ?? "22")
        _username = State(initialValue: existingConnection?.username ?? "")
        _transportType = State(initialValue: existingConnection?.transportType ?? .ssh)
        _sshKeyAlias = State(initialValue: existingConnection?.sshKeyAlias ?? "")
    }

    var body: some View {
        Form {
            // General error message
            if let error = generalError {
                Section {
                    Text(error)
                        .font(TinsuTypography.body)
                        .foregroundColor(TinsuColors.error)
                }
            }

            // Display Name
            Section {
                TextField("Display Name", text: $displayName)
                    .onChange(of: displayName) { _ in
                        displayNameError = nil
                    }
                if let error = displayNameError {
                    Text(error)
                        .font(TinsuTypography.label)
                        .foregroundColor(TinsuColors.error)
                }
            } header: {
                Text("Connection Name")
            }

            // Host
            Section {
                TextField("Host", text: $host)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onChange(of: host) { _ in
                        hostError = nil
                    }
                if let error = hostError {
                    Text(error)
                        .font(TinsuTypography.label)
                        .foregroundColor(TinsuColors.error)
                }
            } header: {
                Text("Server Address")
            } footer: {
                Text("Enter hostname (e.g., example.com) or IP address")
                    .font(TinsuTypography.label)
            }

            // Port and Username
            Section {
                HStack {
                    Text("Port")
                    Spacer()
                    TextField("22", text: $port)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .onChange(of: port) { _ in
                            portError = nil
                        }
                }
                if let error = portError {
                    Text(error)
                        .font(TinsuTypography.label)
                        .foregroundColor(TinsuColors.error)
                }

                TextField("Username", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onChange(of: username) { _ in
                        usernameError = nil
                    }
                if let error = usernameError {
                    Text(error)
                        .font(TinsuTypography.label)
                        .foregroundColor(TinsuColors.error)
                }
            }

            // Transport Type
            Section {
                Picker("Transport", selection: $transportType) {
                    Text("SSH").tag(TransportType.ssh)
                    Text("mosh").tag(TransportType.mosh)
                }
                .pickerStyle(.segmented)
            } header: {
                Text("Connection Protocol")
            } footer: {
                Text("SSH is standard; mosh provides better resilience on unstable connections")
                    .font(TinsuTypography.label)
            }

            // SSH Key Alias
            Section {
                TextField("SSH Key Alias", text: $sshKeyAlias)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } header: {
                Text("SSH Key")
            } footer: {
                Text("Select or generate an SSH key before testing")
                    .font(TinsuTypography.label)
            }

            // --- Test Connection ---
            Section {
                // Test button
                Button(action: triggerTestConnection) {
                    HStack {
                        Spacer()
                        if case .testing = testState {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: TinsuColors.primary))
                            Text("Testing...")
                                .font(TinsuTypography.label)
                        } else {
                            Text("Test Connection")
                                .font(TinsuTypography.label)
                        }
                        Spacer()
                    }
                }
                .secondaryButtonStyle()
                .disabled(isTestStateTesting)

                // Result display
                switch testState {
                case .success(let sessionInfo):
                    TestSuccessCard(sessionInfo: sessionInfo)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                case .failure(let errorType, let message, let hints):
                    TestFailureCard(
                        errorType: errorType,
                        message: message,
                        hints: hints
                    )
                    .transition(.opacity.combined(with: .move(edge: .top)))
                default:
                    EmptyView()
                }

                // Mandatory test notice for new connections
                if !isEditing && !isTested {
                    Text("Test your connection before saving")
                        .font(TinsuTypography.code)
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                }
            } header: {
                Text("Connection Test")
            }

            // Actions
            Section {
                Button(action: validateAndSave) {
                    HStack {
                        Spacer()
                        Text(isEditing ? "Save Changes" : "Create Connection")
                            .frame(maxWidth: .infinity)
                        Spacer()
                    }
                }
                .primaryButtonStyle()
                .disabled(!canSave)

                Button("Cancel") {
                    dismiss()
                }
                .secondaryButtonStyle()
            }
        }
        .navigationTitle(isEditing ? "Edit Connection" : "New Connection")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var isTestStateTesting: Bool {
        if case .testing = testState { return true }
        return false
    }

    // MARK: - Test Connection

    private func triggerTestConnection() {
        testState = .testing

        let portNum = Int(port) ?? 22
        let config = ConnectionConfig(
            id: existingConnection?.id,
            displayName: displayName.trimmingCharacters(in: .whitespaces),
            host: host.trimmingCharacters(in: .whitespaces),
            port: Int32(portNum),
            username: username.trimmingCharacters(in: .whitespaces),
            transportType: transportType,
            sshKeyAlias: sshKeyAlias.trimmingCharacters(in: .whitespaces).isEmpty ? nil : sshKeyAlias.trimmingCharacters(in: .whitespaces),
            sortOrder: existingConnection?.sortOrder ?? 0,
            lastConnectedAt: existingConnection?.lastConnectedAt,
            createdAt: existingConnection?.createdAt ?? Int64(Date().timeIntervalSince1970 * 1000),
            updatedAt: Int64(Date().timeIntervalSince1970 * 1000)
        )

        viewModel.testConnection(config: config)

        // Observe result from ViewModel flow
        Task { @MainActor in
            // Small delay to allow the ViewModel to process
            try? await Task.sleep(nanoseconds: 500_000_000)
            let state = viewModel.getTestState(connectionId: stateKey)
            switch state {
            case let s as Shared.ConnectionTestState.Success:
                testState = .success(sessionInfo: s.sessionInfo)
                isTested = true
            case let f as Shared.ConnectionTestState.Failure:
                testState = .failure(errorType: f.errorType, message: f.message, hints: f.hints)
            default:
                break
            }
        }
    }

    // MARK: - Validation

    private func validateAndSave() {
        displayNameError = nil
        hostError = nil
        usernameError = nil
        portError = nil
        generalError = nil

        var isValid = true

        let trimmedDisplayName = displayName.trimmingCharacters(in: .whitespaces)
        if trimmedDisplayName.isEmpty {
            displayNameError = "Display name is required"
            isValid = false
        } else if trimmedDisplayName.count > 50 {
            displayNameError = "Display name must be 50 characters or less"
            isValid = false
        }

        let trimmedHost = host.trimmingCharacters(in: .whitespaces)
        if trimmedHost.isEmpty {
            hostError = "Host is required"
            isValid = false
        } else if trimmedHost.count > 255 {
            hostError = "Host must be 255 characters or less"
            isValid = false
        }

        let trimmedUsername = username.trimmingCharacters(in: .whitespaces)
        if trimmedUsername.isEmpty {
            usernameError = "Username is required"
            isValid = false
        } else if trimmedUsername.count > 100 {
            usernameError = "Username must be 100 characters or less"
            isValid = false
        }

        guard let portNum = Int(port), portNum >= 1, portNum <= 65535 else {
            portError = "Port must be between 1 and 65535"
            isValid = false
            return
        }

        guard isValid else { return }

        if !isEditing && !isTested {
            generalError = "Test your connection before saving"
            return
        }

        let config = ConnectionConfig(
            id: existingConnection?.id,
            displayName: trimmedDisplayName,
            host: trimmedHost,
            port: Int32(portNum),
            username: trimmedUsername,
            transportType: transportType,
            sshKeyAlias: sshKeyAlias.trimmingCharacters(in: .whitespaces).isEmpty ? nil : sshKeyAlias.trimmingCharacters(in: .whitespaces),
            sortOrder: existingConnection?.sortOrder ?? 0,
            lastConnectedAt: existingConnection?.lastConnectedAt,
            createdAt: existingConnection?.createdAt ?? Int64(Date().timeIntervalSince1970 * 1000),
            updatedAt: Int64(Date().timeIntervalSince1970 * 1000)
        )

        if isEditing {
            repository.updateConnection(config: config) { _, error in
                DispatchQueue.main.async {
                    if let error = error {
                        self.generalError = error.localizedDescription
                    } else {
                        self.onSave()
                        self.dismiss()
                    }
                }
            }
        } else {
            repository.createConnection(config: config) { _, error in
                DispatchQueue.main.async {
                    if let error = error {
                        self.generalError = error.localizedDescription
                    } else {
                        self.onSave()
                        self.dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Test Result Cards

private struct TestSuccessCard: View {
    let sessionInfo: SessionInfo

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(TinsuColors.success)
                    .font(.system(size: 18))
                Text("Connected successfully")
                    .font(TinsuTypography.body)
                    .foregroundColor(TinsuColors.success)
            }
            Text("\(sessionInfo.authenticatedAs)@\(sessionInfo.host):\(sessionInfo.port)")
                .font(TinsuTypography.code)
                .foregroundColor(TinsuColors.success.opacity(0.7))
            if !sessionInfo.serverVersion.isEmpty {
                Text(sessionInfo.serverVersion)
                    .font(TinsuTypography.lineNumbers)
                    .foregroundColor(TinsuColors.onSurfaceVariant)
            }
        }
        .padding(TinsuSpacing.cardPadding)
        .background(TinsuColors.success.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(TinsuColors.success.opacity(0.3), lineWidth: 1)
        )
        .cornerRadius(8)
    }
}

private struct TestFailureCard: View {
    let errorType: ConnectionErrorType
    let message: String
    let hints: [String]

    private var errorLabel: String {
        switch errorType {
        case .hostUnreachable: return "Host Unreachable"
        case .authFailed: return "Authentication Failed"
        case .timeout: return "Connection Timed Out"
        case .portBlocked: return "Port Blocked"
        case .keyNotFound: return "SSH Key Not Found"
        case .networkError: return "Network Error"
        default: return "Connection Failed"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(TinsuColors.error)
                    .font(.system(size: 18))
                Text(errorLabel)
                    .font(TinsuTypography.body)
                    .foregroundColor(TinsuColors.error)
            }

            Text(message)
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.onBackground)

            if !hints.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Troubleshooting:")
                        .font(TinsuTypography.label)
                        .foregroundColor(TinsuColors.onSurfaceVariant)

                    ForEach(hints, id: \.self) { hint in
                        HStack(alignment: .top, spacing: 4) {
                            Text(">")
                                .font(TinsuTypography.code)
                                .foregroundColor(TinsuColors.warning)
                            Text(hint)
                                .font(TinsuTypography.label)
                                .foregroundColor(TinsuColors.onSurfaceVariant)
                        }
                        .padding(.leading, 8)
                    }
                }
            }
        }
        .padding(TinsuSpacing.cardPadding)
        .background(TinsuColors.error.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(TinsuColors.error.opacity(0.3), lineWidth: 1)
        )
        .cornerRadius(8)
    }
}

// MARK: - Local Test State (mirrors KMP sealed class for SwiftUI)

private enum ConnectionTestState {
    case idle
    case testing
    case success(sessionInfo: SessionInfo)
    case failure(errorType: ConnectionErrorType, message: String, hints: [String])
}

// MARK: - Preview

#Preview("New Connection") {
    NavigationView {
        ConnectionEditScreen(
            existingConnection: nil,
            repository: FakeConnectionRepository(),
            viewModel: ConnectionListViewModel(repository: FakeConnectionRepository()),
            onSave: {}
        )
    }
    .preferredColorScheme(.dark)
}

#Preview("Edit Connection") {
    NavigationView {
        ConnectionEditScreen(
            existingConnection: ConnectionConfig(
                id: "1",
                displayName: "My Server",
                host: "example.com",
                port: 22,
                username: "user",
                transportType: .ssh,
                sshKeyAlias: "my-key",
                sortOrder: 0,
                lastConnectedAt: KotlinLong(value: Int64(Date().timeIntervalSince1970 * 1000)),
                createdAt: Int64(Date().timeIntervalSince1970 * 1000),
                updatedAt: Int64(Date().timeIntervalSince1970 * 1000)
            ),
            repository: FakeConnectionRepository(),
            viewModel: ConnectionListViewModel(repository: FakeConnectionRepository()),
            onSave: {}
        )
    }
    .preferredColorScheme(.dark)
}
