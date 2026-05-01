/**
 * ChatPersonaSelector Tests - Story 10.2 (AC: 5)
 *
 * Tests: all 4 personas rendered, selection highlight changes,
 * callback fires with correct persona key.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPersonaSelector, type ChatPersonaKey } from './ChatPersonaSelector'

describe('ChatPersonaSelector (Story 10.2, AC: 5)', () => {
  const defaultProps = {
    selectedPersona: 'bmad-agent-pm' as ChatPersonaKey,
    onPersonaChange: vi.fn()
  }

  it('renders all 4 persona buttons', () => {
    render(<ChatPersonaSelector {...defaultProps} />)

    expect(screen.getByText('PM')).toBeInTheDocument()
    expect(screen.getByText('Architect')).toBeInTheDocument()
    expect(screen.getByText('UX Designer')).toBeInTheDocument()
    expect(screen.getByText('Analyst')).toBeInTheDocument()
  })

  it('renders the persona selector container', () => {
    render(<ChatPersonaSelector {...defaultProps} />)

    expect(screen.getByTestId('chat-persona-selector')).toBeInTheDocument()
  })

  it('marks the selected persona button with aria-pressed=true', () => {
    render(<ChatPersonaSelector {...defaultProps} selectedPersona="bmad-agent-architect" />)

    const architectButton = screen.getByTestId('persona-button-architect')
    expect(architectButton).toHaveAttribute('aria-pressed', 'true')

    const pmButton = screen.getByTestId('persona-button-pm')
    expect(pmButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onPersonaChange with the correct persona key when clicked', () => {
    const onPersonaChange = vi.fn()
    render(<ChatPersonaSelector {...defaultProps} onPersonaChange={onPersonaChange} />)

    fireEvent.click(screen.getByText('Architect'))
    expect(onPersonaChange).toHaveBeenCalledWith('bmad-agent-architect')

    fireEvent.click(screen.getByText('UX Designer'))
    expect(onPersonaChange).toHaveBeenCalledWith('bmad-agent-ux-designer')

    fireEvent.click(screen.getByText('Analyst'))
    expect(onPersonaChange).toHaveBeenCalledWith('bmad-agent-analyst')

    fireEvent.click(screen.getByText('PM'))
    expect(onPersonaChange).toHaveBeenCalledWith('bmad-agent-pm')
  })

  it('applies highlighted styles to the selected persona', () => {
    render(<ChatPersonaSelector {...defaultProps} selectedPersona="bmad-agent-pm" />)

    const pmButton = screen.getByTestId('persona-button-pm')
    // Selected button should have green bg tint and text classes
    expect(pmButton.className).toContain('bg-green-500/20')
    expect(pmButton.className).toContain('text-green-400')
  })

  it('does not apply highlighted styles to unselected personas', () => {
    render(<ChatPersonaSelector {...defaultProps} selectedPersona="bmad-agent-pm" />)

    const architectButton = screen.getByTestId('persona-button-architect')
    expect(architectButton.className).toContain('text-muted-foreground')
    expect(architectButton.className).not.toContain('bg-orange-500/20')
  })
})
