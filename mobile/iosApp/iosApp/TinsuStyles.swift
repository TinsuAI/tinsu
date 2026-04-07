import SwiftUI

// MARK: - Primary Button Modifier
/// Filled prominent style — primary CTA.
struct PrimaryButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .buttonStyle(.borderedProminent)
            .tint(TinsuColors.primary)
    }
}

// MARK: - Secondary Button Modifier
/// Outlined bordered style — secondary action.
struct SecondaryButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .buttonStyle(.bordered)
            .tint(TinsuColors.primary)
    }
}

// MARK: - Destructive Button Modifier
/// Bordered with error tint — irreversible actions.
struct DestructiveButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .buttonStyle(.bordered)
            .tint(TinsuColors.error)
    }
}

// MARK: - Tertiary Button Modifier
/// Plain, no background — low-emphasis actions.
struct TertiaryButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .buttonStyle(.plain)
            .foregroundColor(TinsuColors.primary)
    }
}

// MARK: - TinsuIcon Modifier
/// Applies monochrome symbol rendering with Terminal Luxe tint.
struct TinsuIcon: ViewModifier {
    var color: Color = TinsuColors.primary

    func body(content: Content) -> some View {
        content
            .symbolRenderingMode(.monochrome)
            .foregroundColor(color)
    }
}

// MARK: - View Extensions
extension View {
    func primaryButtonStyle() -> some View {
        modifier(PrimaryButtonStyle())
    }

    func secondaryButtonStyle() -> some View {
        modifier(SecondaryButtonStyle())
    }

    func destructiveButtonStyle() -> some View {
        modifier(DestructiveButtonStyle())
    }

    func tertiaryButtonStyle() -> some View {
        modifier(TertiaryButtonStyle())
    }

    func tinsuIcon(color: Color = TinsuColors.primary) -> some View {
        modifier(TinsuIcon(color: color))
    }
}

// MARK: - Task 9: Full Design Token Preview
/// Demonstrates colors, typography, buttons, loading, and SF Symbols in one preview.
struct TinsuDesignPreview: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                colorPaletteSection
                divider
                typographySection
                divider
                buttonHierarchySection
                divider
                loadingSection
                divider
                sfSymbolSection
            }
            .padding(TinsuSpacing.contentMargin)
        }
        .background(TinsuColors.background)
    }

    // MARK: Color Palette
    private var colorPaletteSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Color Palette")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))], spacing: 8) {
                colorSwatch(TinsuColors.background,      name: "background")
                colorSwatch(TinsuColors.surface,         name: "surface")
                colorSwatch(TinsuColors.surfaceVariant,  name: "surfaceVariant")
                colorSwatch(TinsuColors.primary,         name: "primary")
                colorSwatch(TinsuColors.onBackground,    name: "onBackground")
                colorSwatch(TinsuColors.onSurface,       name: "onSurface")
                colorSwatch(TinsuColors.success,         name: "success")
                colorSwatch(TinsuColors.warning,         name: "warning")
                colorSwatch(TinsuColors.error,           name: "error")
                colorSwatch(TinsuColors.outline,         name: "outline")
                colorSwatch(TinsuColors.userBubble,      name: "userBubble")
                colorSwatch(TinsuColors.agentBubble,     name: "agentBubble")
            }
        }
    }

    private func colorSwatch(_ color: Color, name: String) -> some View {
        VStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 8)
                .fill(color)
                .frame(height: 44)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(TinsuColors.outline, lineWidth: 1)
                )
            Text(name)
                .font(TinsuTypography.lineNumbers)
                .foregroundColor(TinsuColors.onSurfaceVariant)
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: Typography
    private var typographySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Typography")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)

            Group {
                Text("Display 28pt Bold")
                    .font(TinsuTypography.display)
                    .foregroundColor(TinsuColors.onBackground)
                Text("Headline 22pt Semibold")
                    .font(TinsuTypography.headline)
                    .foregroundColor(TinsuColors.onBackground)
                Text("Title 18pt Medium")
                    .font(TinsuTypography.title)
                    .foregroundColor(TinsuColors.onBackground)
                Text("Body 17pt Regular — Dynamic Type")
                    .font(TinsuTypography.body)
                    .foregroundColor(TinsuColors.onBackground)
                Text("Label 13pt Regular")
                    .font(TinsuTypography.label)
                    .foregroundColor(TinsuColors.onSurface)
                Text("code { font: SF Mono 13pt; }")
                    .font(TinsuTypography.code)
                    .foregroundColor(TinsuColors.onBackground)
                Text("001 line numbers 11pt")
                    .font(TinsuTypography.lineNumbers)
                    .foregroundColor(TinsuColors.onSurfaceVariant)
            }
        }
    }

    // MARK: Buttons
    private var buttonHierarchySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Button Hierarchy")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)

            HStack(spacing: 12) {
                Button("Primary") {}
                    .primaryButtonStyle()
                    .frame(minWidth: TinsuSpacing.minTouchTarget,
                           minHeight: TinsuSpacing.minTouchTarget)

                Button("Secondary") {}
                    .secondaryButtonStyle()
                    .frame(minWidth: TinsuSpacing.minTouchTarget,
                           minHeight: TinsuSpacing.minTouchTarget)
            }

            HStack(spacing: 12) {
                Button("Destructive") {}
                    .destructiveButtonStyle()
                    .frame(minWidth: TinsuSpacing.minTouchTarget,
                           minHeight: TinsuSpacing.minTouchTarget)

                Button("Tertiary") {}
                    .tertiaryButtonStyle()
                    .frame(minWidth: TinsuSpacing.minTouchTarget,
                           minHeight: TinsuSpacing.minTouchTarget)
            }

            HStack(spacing: 16) {
                Image(systemName: "star.fill")
                    .font(.title2)
                    .tinsuIcon()
                Image(systemName: "bell.fill")
                    .font(.title2)
                    .tinsuIcon(color: TinsuColors.warning)
                Image(systemName: "trash.fill")
                    .font(.title2)
                    .tinsuIcon(color: TinsuColors.error)
            }
        }
    }

    // MARK: Loading
    private var loadingSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Loading State")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)
            AgentThinkingView()
        }
    }

    // MARK: SF Symbols
    private var sfSymbolSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SF Symbols (monochrome)")
                .font(TinsuTypography.headline)
                .foregroundColor(TinsuColors.onBackground)

            HStack(spacing: 20) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.title)
                    .tinsuIcon()
                Image(systemName: "doc.text")
                    .font(.title)
                    .tinsuIcon()
                Image(systemName: "checklist")
                    .font(.title)
                    .tinsuIcon()
                Image(systemName: "gearshape")
                    .font(.title)
                    .tinsuIcon()
                Image(systemName: "checkmark.circle.fill")
                    .font(.title)
                    .tinsuIcon(color: TinsuColors.success)
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title)
                    .tinsuIcon(color: TinsuColors.warning)
                Image(systemName: "xmark.circle.fill")
                    .font(.title)
                    .tinsuIcon(color: TinsuColors.error)
            }
        }
    }

    private var divider: some View {
        Divider()
            .background(TinsuColors.outline)
    }
}

// MARK: - Previews
struct TinsuDesignPreview_Previews: PreviewProvider {
    static var previews: some View {
        TinsuDesignPreview()
            .preferredColorScheme(.dark)
            .previewDisplayName("Terminal Luxe Design System — Dark")

        TinsuDesignPreview()
            .preferredColorScheme(.light)
            .previewDisplayName("Terminal Luxe Design System — Light")
    }
}
