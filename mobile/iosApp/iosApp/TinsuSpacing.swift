import CoreGraphics

// MARK: - TinsuSpacing
/// Terminal Luxe spacing constants. All values in points.
enum TinsuSpacing {

    /// Standard content margin — 16pt.
    static let contentMargin: CGFloat = 16

    /// Card inner padding — 16pt.
    static let cardPadding: CGFloat = 16

    /// Minimum interactive touch target — 44pt (HIG requirement).
    static let minTouchTarget: CGFloat = 44

    /// System tab bar height — 49pt (plus safe area inset at runtime).
    static let tabBarHeight: CGFloat = 49
}
