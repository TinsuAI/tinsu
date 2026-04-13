import SwiftUI
import Shared

/// Connection status for the indicator dot.
enum ConnectionStatus {
    case unknown
    case recentlyConnected
    case failed

    var color: Color {
        switch self {
        case .unknown: return TinsuColors.onSurfaceVariant
        case .recentlyConnected: return TinsuColors.success
        case .failed: return TinsuColors.error
        }
    }
}

/// Determines the connection status based on last connected timestamp.
func determineConnectionStatus(lastConnectedAt: KotlinLong?) -> ConnectionStatus {
    guard let lastConnectedAt else { return .unknown }
    let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
    let elapsed = nowMs - lastConnectedAt.int64Value
    switch elapsed {
    case 0..<86_400_000:
        return .recentlyConnected
    default:
        return .unknown
    }
}

/// Formats the last connected timestamp as a relative time string.
func formatLastConnected(lastConnectedAt: KotlinLong?) -> String {
    guard let lastConnectedAt else { return "Never" }
    let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
    let elapsed = nowMs - lastConnectedAt.int64Value
    switch elapsed {
    case 0..<60_000: return "Just now"
    case 60_000..<3_600_000: return "\(elapsed / 60_000)m ago"
    case 3_600_000..<86_400_000: return "\(elapsed / 3_600_000)h ago"
    case 86_400_000..<604_800_000: return "\(elapsed / 86_400_000)d ago"
    default: return "Long ago"
    }
}

/// SwiftUI view for a connection card matching Android design.
struct ConnectionCardView: View {
    let connection: ConnectionConfig
    let status: ConnectionStatus
    let onEdit: () -> Void
    let onDelete: () -> Void
    var isDraggable: Bool = true

    init(
        connection: ConnectionConfig,
        status: ConnectionStatus? = nil,
        onEdit: @escaping () -> Void,
        onDelete: @escaping () -> Void,
        isDraggable: Bool = true
    ) {
        self.connection = connection
        self.status = status ?? determineConnectionStatus(lastConnectedAt: connection.lastConnectedAt)
        self.onEdit = onEdit
        self.onDelete = onDelete
        self.isDraggable = isDraggable
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // Drag handle
            if isDraggable {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 14))
                    .foregroundColor(TinsuColors.onSurfaceVariant)
            }

            // Status indicator dot
            Circle()
                .fill(status.color)
                .frame(width: 8, height: 8)

            // Connection details
            VStack(alignment: .leading, spacing: 4) {
                // Display name
                Text(connection.displayName)
                    .font(TinsuTypography.title)
                    .foregroundColor(TinsuColors.onSurface)
                    .lineLimit(1)

                // host:port
                HStack(spacing: 6) {
                    Text("\(connection.host):\(Int(connection.port))")
                        .font(TinsuTypography.code)
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                        .lineLimit(1)

                    // Transport type badge
                    Text(transportDisplayName(from: connection.transportType))
                        .font(TinsuTypography.label)
                        .foregroundColor(TinsuColors.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            TinsuColors.primary.opacity(0.1),
                            in: RoundedRectangle(cornerRadius: 4)
                        )
                }

                // Last connected timestamp
                Text(formatLastConnected(lastConnectedAt: connection.lastConnectedAt))
                    .font(TinsuTypography.label)
                    .foregroundColor(TinsuColors.onSurfaceVariant)
                    .lineLimit(1)

                // SSH key alias if present
                if let keyAlias = connection.sshKeyAlias, !keyAlias.isEmpty {
                    Text("Key: \(keyAlias)")
                        .font(TinsuTypography.code)
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Action buttons
            HStack(spacing: 8) {
                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .font(.system(size: 16))
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                }
                .buttonStyle(.plain)

                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .font(.system(size: 16))
                        .foregroundColor(TinsuColors.error)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(TinsuColors.surfaceVariant)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(TinsuColors.outline, lineWidth: 1)
        )
    }

    private func transportDisplayName(from type: TransportType) -> String {
        switch type {
        case .ssh: return "SSH"
        case .mosh: return "mosh"
        default: return "SSH"
        }
    }
}

// MARK: - Preview
#Preview {
    VStack(alignment: .leading, spacing: 8) {
        ConnectionCardView(
            connection: ConnectionConfig(
                id: "1",
                displayName: "My Server",
                host: "example.com",
                port: 22,
                username: "user",
                transportType: .ssh,
                sshKeyAlias: "my-key",
                sortOrder: 0,
                lastConnectedAt: KotlinLong(value: Int64(Date().timeIntervalSince1970 * 1000) - 3600000),
                createdAt: Int64(Date().timeIntervalSince1970 * 1000) - 86400000,
                updatedAt: Int64(Date().timeIntervalSince1970 * 1000) - 3600000
            ),
            onEdit: {},
            onDelete: {}
        )

        ConnectionCardView(
            connection: ConnectionConfig(
                id: "2",
                displayName: "Production",
                host: "192.168.1.100",
                port: 2222,
                username: "admin",
                transportType: .mosh,
                sshKeyAlias: nil,
                sortOrder: 1,
                lastConnectedAt: nil,
                createdAt: Int64(Date().timeIntervalSince1970 * 1000),
                updatedAt: Int64(Date().timeIntervalSince1970 * 1000)
            ),
            status: .unknown,
            onEdit: {},
            onDelete: {}
        )
    }
    .padding()
    .background(TinsuColors.background)
}
