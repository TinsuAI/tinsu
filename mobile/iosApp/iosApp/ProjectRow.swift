import SwiftUI
import Shared

/// Row view for a single discovered project.
struct ProjectRow: View {
    let project: ProjectInfo
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(project.name)
                        .font(TinsuTypography.title)
                        .foregroundColor(isSelected ? TinsuColors.warning : TinsuColors.onSurface)
                        .lineLimit(1)

                    Text(project.path)
                        .font(TinsuTypography.code)
                        .foregroundColor(TinsuColors.onSurfaceVariant)
                        .lineLimit(1)
                }

                Spacer()

                if project.activeSessionCount > 0 {
                    sessionBadge(count: Int(project.activeSessionCount))
                }

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(TinsuColors.warning)
                        .font(.system(size: 20))
                }
            }
            .padding(TinsuSpacing.cardPadding)
            .background(TinsuColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? TinsuColors.warning : TinsuColors.outline, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func sessionBadge(count: Int) -> some View {
        Text("\(count) active")
            .font(TinsuTypography.lineNumbers)
            .foregroundColor(TinsuColors.warning)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(TinsuColors.warning.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: 8) {
        ProjectRow(
            project: ProjectInfo(name: "my-app", path: "/home/user/projects/my-app", activeSessionCount: 3),
            isSelected: true,
            onTap: {}
        )
        ProjectRow(
            project: ProjectInfo(name: "other-project", path: "/home/user/code/other-project", activeSessionCount: 0),
            isSelected: false,
            onTap: {}
        )
    }
    .padding()
    .background(TinsuColors.background)
    .preferredColorScheme(.dark)
}
