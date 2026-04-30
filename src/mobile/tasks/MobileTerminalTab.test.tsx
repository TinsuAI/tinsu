import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileTerminalTab } from './MobileTerminalTab'
import { createRef } from 'react'
import type { MobileTerminalTabRef } from './MobileTerminalTab'

// Mock TaskTerminal — cross-tree component (AC 16, guardrail 7)
vi.mock('@renderer/components/task/TaskTerminal', () => ({
  TaskTerminal: vi.fn().mockImplementation(({ taskId }: { taskId: string }) => (
    <div data-testid="task-terminal-mock" data-task-id={taskId} />
  )),
}))

// Mock TerminalAccessoryBar — cross-tree component (AC 16)
vi.mock('@renderer/components/terminal/TerminalAccessoryBar', () => ({
  TerminalAccessoryBar: ({ onKeyPress }: { onKeyPress: (key: string) => void }) => (
    <div
      data-testid="terminal-accessory-bar-mock"
      onClick={() => onKeyPress('\t')}
    />
  ),
}))

// navigator.vibrate stub
beforeAll(() => {
  if (!('vibrate' in navigator)) {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => true,
      writable: true,
      configurable: true,
    })
  }
})

describe('MobileTerminalTab', () => {
  it('mounts TaskTerminal with correct taskId', () => {
    render(<MobileTerminalTab taskId="task-xyz" />)
    const terminal = screen.getByTestId('task-terminal-mock')
    expect(terminal).toBeInTheDocument()
    expect(terminal).toHaveAttribute('data-task-id', 'task-xyz')
  })

  it('renders TerminalAccessoryBar', () => {
    render(<MobileTerminalTab taskId="task-xyz" />)
    expect(screen.getByTestId('terminal-accessory-bar-mock')).toBeInTheDocument()
  })

  it('wraps content in mobile-terminal-tab testid', () => {
    render(<MobileTerminalTab taskId="task-xyz" />)
    expect(screen.getByTestId('mobile-terminal-tab')).toBeInTheDocument()
  })

  it('exposes focusInput via forwardRef', () => {
    const ref = createRef<MobileTerminalTabRef>()
    render(<MobileTerminalTab ref={ref} taskId="task-xyz" />)
    expect(ref.current).not.toBeNull()
    expect(typeof ref.current?.focusInput).toBe('function')
  })

  it('calling focusInput via ref does not throw', () => {
    const ref = createRef<MobileTerminalTabRef>()
    render(<MobileTerminalTab ref={ref} taskId="task-xyz" />)
    expect(() => ref.current?.focusInput()).not.toThrow()
  })
})
