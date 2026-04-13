import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BranchStatusIndicator } from './BranchStatusIndicator'

describe('BranchStatusIndicator (Story 8.9)', () => {
  describe('AC: 1 - Branch icon with truncated name', () => {
    it('renders branch icon with full name when under 20 chars', () => {
      render(<BranchStatusIndicator branchName="feature/auth" isMerged={false} />)

      const indicator = screen.getByTestId('branch-status-indicator')
      expect(indicator).toBeInTheDocument()
      expect(indicator).toHaveTextContent('feature/auth')
    })

    it('truncates branch name over 20 chars with ellipsis', () => {
      render(
        <BranchStatusIndicator
          branchName="tinsu/story-123-user-authentication"
          isMerged={false}
        />
      )

      const indicator = screen.getByTestId('branch-status-indicator')
      expect(indicator).toBeInTheDocument()
      // Should be truncated to 17 chars + "..."
      expect(indicator).toHaveTextContent('tinsu/story-123-u...')
    })

    it('renders nothing when branchName is null', () => {
      const { container } = render(
        <BranchStatusIndicator branchName={null} isMerged={false} />
      )
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('AC: 2 - Commits behind warning', () => {
    it('shows behind badge when commitsBehind > 0', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={false}
          commitsBehind={3}
        />
      )

      const behindBadge = screen.getByTestId('commits-behind-badge')
      expect(behindBadge).toBeInTheDocument()
      expect(behindBadge).toHaveTextContent('3 behind')
    })

    it('does not show behind badge when commitsBehind is 0', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={false}
          commitsBehind={0}
        />
      )

      expect(screen.queryByTestId('commits-behind-badge')).not.toBeInTheDocument()
    })

    it('shows ahead badge when commitsAhead > 0', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={false}
          commitsAhead={5}
        />
      )

      const aheadBadge = screen.getByTestId('commits-ahead-badge')
      expect(aheadBadge).toBeInTheDocument()
      expect(aheadBadge).toHaveTextContent('5 ahead')
    })

    it('does not show ahead badge when commitsAhead is 0', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={false}
          commitsAhead={0}
        />
      )

      expect(screen.queryByTestId('commits-ahead-badge')).not.toBeInTheDocument()
    })

    it('shows both badges when ahead and behind', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={false}
          commitsAhead={2}
          commitsBehind={4}
        />
      )

      expect(screen.getByTestId('commits-ahead-badge')).toBeInTheDocument()
      expect(screen.getByTestId('commits-behind-badge')).toBeInTheDocument()
    })
  })

  describe('AC: 3 - Uncommitted changes indicator', () => {
    it('shows uncommitted indicator when hasUncommittedChanges is true', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={false}
          hasUncommittedChanges={true}
        />
      )

      const indicator = screen.getByTestId('uncommitted-indicator')
      expect(indicator).toBeInTheDocument()
    })

    it('does not show uncommitted indicator when hasUncommittedChanges is false', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={false}
          hasUncommittedChanges={false}
        />
      )

      expect(screen.queryByTestId('uncommitted-indicator')).not.toBeInTheDocument()
    })
  })

  describe('AC: 4 - Merged state', () => {
    it('shows "Merged" text with check icon when isMerged is true', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={true}
        />
      )

      const mergedIndicator = screen.getByTestId('branch-status-merged')
      expect(mergedIndicator).toBeInTheDocument()
      expect(mergedIndicator).toHaveTextContent('Merged')
    })

    it('does not show branch name or badges when merged', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={true}
          commitsAhead={5}
          commitsBehind={3}
        />
      )

      // Should not show the regular indicator, only merged
      expect(screen.queryByTestId('branch-status-indicator')).not.toBeInTheDocument()
      expect(screen.queryByTestId('commits-ahead-badge')).not.toBeInTheDocument()
      expect(screen.queryByTestId('commits-behind-badge')).not.toBeInTheDocument()
    })
  })

  describe('styling and props', () => {
    it('applies custom className', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={false}
          className="custom-class"
        />
      )

      const indicator = screen.getByTestId('branch-status-indicator')
      expect(indicator).toHaveClass('custom-class')
    })

    it('applies custom className to merged state', () => {
      render(
        <BranchStatusIndicator
          branchName="feature/test"
          isMerged={true}
          className="merged-custom"
        />
      )

      const mergedIndicator = screen.getByTestId('branch-status-merged')
      expect(mergedIndicator).toHaveClass('merged-custom')
    })
  })
})
