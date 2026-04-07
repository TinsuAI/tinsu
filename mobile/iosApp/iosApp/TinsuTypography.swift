import SwiftUI

// MARK: - TinsuTypography
/// Terminal Luxe type scale with Dynamic Type support.
/// Body and code use semantic textStyles for automatic scaling.
/// Display/headline/title/label use system sizes matching the spec.
enum TinsuTypography {

    /// SF Pro Display 28pt Bold — screen titles.
    static let display     = Font.system(size: 28, weight: .bold,     design: .default)

    /// SF Pro Display 22pt Semibold — section headers.
    static let headline    = Font.system(size: 22, weight: .semibold, design: .default)

    /// SF Pro Text 18pt Medium — card titles.
    static let title       = Font.system(size: 18, weight: .medium,   design: .default)

    /// SF Pro Text body — scales automatically with Dynamic Type (NFR29).
    static let body        = Font.system(.body)

    /// SF Pro Text 13pt Regular — labels and captions.
    static let label       = Font.system(size: 13, weight: .regular,  design: .default)

    /// SF Mono — code blocks; uses body textStyle for automatic Dynamic Type scaling (NFR29).
    static let code        = Font.system(.body, design: .monospaced)

    /// SF Mono 11pt Regular — code line numbers.
    static let lineNumbers = Font.system(size: 11, weight: .regular,  design: .monospaced)
}
