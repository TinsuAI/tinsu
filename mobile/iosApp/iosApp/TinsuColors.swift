import SwiftUI

// MARK: - Hex Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255)
    }
}

// MARK: - TinsuColors
/// Terminal Luxe color tokens mirroring Android hex values 1:1.
enum TinsuColors {

    // MARK: Dark Theme (default)
    static let background      = Color(hex: "#0D1117")
    static let surface         = Color(hex: "#161B22")
    static let surfaceVariant  = Color(hex: "#1C2128")
    static let primary         = Color(hex: "#58A6FF")
    static let onPrimary       = Color(hex: "#FFFFFF")
    static let onBackground    = Color(hex: "#E6EDF3")
    static let onSurface       = Color(hex: "#C9D1D9")
    static let onSurfaceVariant = Color(hex: "#8B949E")
    static let success         = Color(hex: "#3FB950")
    static let warning         = Color(hex: "#D29922")
    static let error           = Color(hex: "#F85149")
    static let outline         = Color(hex: "#30363D")
    static let userBubble      = Color(hex: "#1F3A5F")
    static let agentBubble     = Color(hex: "#161B22")

    // MARK: Light Theme
    static let lightBackground      = Color(hex: "#FFFFFF")
    static let lightSurface         = Color(hex: "#F6F8FA")
    static let lightSurfaceVariant  = Color(hex: "#EFF1F3")
    static let lightPrimary         = Color(hex: "#0969DA")
    static let lightOnBackground    = Color(hex: "#1F2328")
    static let lightOnSurface       = Color(hex: "#656D76")
    static let lightUserBubble      = Color(hex: "#DDF4FF")
    static let lightAgentBubble     = Color(hex: "#F6F8FA")
}
