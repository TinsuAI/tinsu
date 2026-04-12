import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StoryFileStatusBadge } from './StoryFileStatusBadge'

describe('StoryFileStatusBadge (Story 5.2c)', () => {
  it('renders summary_only status with FileText icon', () => {
    render(<StoryFileStatusBadge status="summary_only" />)

    const badge = screen.getByTestId('story-file-status-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('title', expect.stringContaining('Needs full story creation'))
  })

  it('renders story_ready status with CheckCircle icon', () => {
    render(<StoryFileStatusBadge status="story_ready" />)

    const badge = screen.getByTestId('story-file-status-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('title', expect.stringContaining('Story file ready'))
  })

  it('renders nothing for null status', () => {
    const { container } = render(<StoryFileStatusBadge status={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders clickable story file path when story_ready with path', () => {
    const onPathClick = vi.fn()
    render(
      <StoryFileStatusBadge
        status="story_ready"
        storyFilePath="/path/to/story.md"
        onPathClick={onPathClick}
      />
    )

    const link = screen.getByTestId('story-file-link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveTextContent('story.md')
  })

  it('does not render path link for summary_only', () => {
    render(
      <StoryFileStatusBadge status="summary_only" storyFilePath="/path/to/story.md" />
    )

    expect(screen.queryByTestId('story-file-link')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<StoryFileStatusBadge status="summary_only" className="custom-class" />)

    const badge = screen.getByTestId('story-file-status-badge')
    expect(badge).toHaveClass('custom-class')
  })
})
