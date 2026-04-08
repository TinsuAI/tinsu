import SwiftUI

/// Bottom sheet displaying connection details for iOS.
/// Shows host, port, transport type, uptime, and latency.
struct ConnectionDetailsSheet: View {
    let connectionState: ConnectionState
    let latencyMs: Int?
    let onDismiss: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            // Background
            TinsuColors.surface.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Title
                    Text("Connection Details")
                        .font(TinsuTypography.headline)
                        .foregroundColor(TinsuColors.onSurface)
                        .padding(.bottom, 8)

                    // Connection information based on state
                    switch connectionState {
                    case .connected(let host, let port, let transport, let uptime):
                        ConnectedDetailsView(
                            host: host,
                            port: port,
                            transport: transport,
                            uptime: uptime,
                            latencyMs: latencyMs
                        )
                    case .reconnecting:
                        ReconnectingDetailsView()
                    case .disconnected(let reason):
                        DisconnectedDetailsView(reason: reason)
                    case .offline:
                        OfflineDetailsView()
                    }

                    Spacer()
                }
                .padding(16)
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func ConnectedDetailsView(
        host: String,
        port: Int,
        transport: String,
        uptime: TimeInterval,
        latencyMs: Int?
    ) -> some View {
        DetailRow(
            icon: "server",
            label: "Host",
            value: "\(host):\(port)"
        )

        DetailRow(
            icon: "network",
            label: "Transport",
            value: transport
        )

        DetailRow(
            icon: "clock",
            label: "Uptime",
            value: formatUptime(uptime)
        )

        if let latency = latencyMs {
            DetailRow(
                icon: "network",
                label: "Latency",
                value: "\(latency)ms"
            )
        }
    }

    @ViewBuilder
    private func ReconnectingDetailsView() -> some View {
        Text("Reconnecting to remote PC...")
            .font(TinsuTypography.body)
            .foregroundColor(TinsuColors.onSurfaceVariant)
    }

    @ViewBuilder
    private func DisconnectedDetailsView(reason: String?) -> some View {
        Text("Connection lost or failed.")
            .font(TinsuTypography.body)
            .foregroundColor(TinsuColors.onSurfaceVariant)

        if let reason = reason {
            Text("Reason: \(reason)")
                .font(TinsuTypography.body)
                .foregroundColor(TinsuColors.error)
                .padding(.top, 8)
        }
    }

    @ViewBuilder
    private func OfflineDetailsView() -> some View {
        Text("Network is unavailable.")
            .font(TinsuTypography.body)
            .foregroundColor(TinsuColors.onSurfaceVariant)
    }

    private func formatUptime(_ uptime: TimeInterval) -> String {
        let totalSeconds = Int(uptime)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60

        if totalSeconds < 60 {
            return "< 1m"
        } else if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m \(seconds)s"
        }
    }
}

/// Helper view for displaying a detail row with icon and value.
struct DetailRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(TinsuColors.onSurfaceVariant)
                .frame(width: 20, height: 20)

            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(TinsuTypography.label)
                    .foregroundColor(TinsuColors.onSurfaceVariant)

                Text(value)
                    .font(TinsuTypography.code)
                    .foregroundColor(TinsuColors.onSurface)
            }
        }
    }
}

/// Extended ConnectionState with details for connected state.
extension ConnectionState {
    static func connected(
        host: String,
        port: Int,
        transport: String,
        uptime: TimeInterval
    ) -> ConnectionState {
        return .connected(host: host, port: port, transport: transport, uptime: uptime)
    }
}

#Preview {
    ConnectionDetailsSheet(
        connectionState: .connected(
            host: "192.168.1.100",
            port: 22,
            transport: "SSH",
            uptime: 3665
        ),
        latencyMs: 45,
        onDismiss: {}
    )
}
