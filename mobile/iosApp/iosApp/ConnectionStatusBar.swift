import SwiftUI

/// Compact connection status bar component for iOS.
/// Displays an 8pt dot + label indicating current connection state.
struct ConnectionStatusBar: View {
    let connectionState: ConnectionState
    let onTap: () -> Void

    @State private var pulseOpacity: Double = 1.0

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 8) {
                // Status indicator dot (8pt)
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                    .opacity(pulseOpacity)
                    .onAppear {
                        if case .reconnecting = connectionState {
                            startPulseAnimation()
                        }
                    }
                    .animation(.easeInOut(duration: 0.2), value: statusColor)

                // Status text label
                Text(statusText)
                    .font(TinsuTypography.label)
                    .foregroundColor(TinsuColors.onSurface)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var statusColor: Color {
        switch connectionState {
        case .connected:
            return TinsuColors.success
        case .reconnecting:
            return TinsuColors.warning
        case .disconnected:
            return TinsuColors.error
        case .offline:
            return TinsuColors.outline
        }
    }

    private var statusText: String {
        switch connectionState {
        case .connected:
            return "Connected"
        case .reconnecting:
            return "Reconnecting..."
        case .disconnected:
            return "Disconnected"
        case .offline:
            return "Offline"
        }
    }

    private func startPulseAnimation() {
        withAnimation(
            Animation
                .easeInOut(duration: 1.0)
                .repeatForever(autoreverses: true)
        ) {
            pulseOpacity = 0.5
        }
    }
}

/// Connection state enum for iOS UI components.
enum ConnectionState {
    case connected(host: String, port: Int, transport: String, uptime: TimeInterval)
    case reconnecting
    case disconnected(reason: String?)
    case offline
}

#Preview {
    VStack(spacing: 16) {
        ConnectionStatusBar(connectionState: .connected(host: "192.168.1.100", port: 22, transport: "SSH", uptime: 3665)) {}
        ConnectionStatusBar(connectionState: .reconnecting) {}
        ConnectionStatusBar(connectionState: .disconnected(reason: nil)) {}
        ConnectionStatusBar(connectionState: .offline) {}
    }
    .padding()
    .background(TinsuColors.background)
}
