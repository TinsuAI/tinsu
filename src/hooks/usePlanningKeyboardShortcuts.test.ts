import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePlanningKeyboardShortcuts, type PlanningKeyboardShortcutCallbacks } from './usePlanningKeyboardShortcuts'

function createCallbacks(): PlanningKeyboardShortcutCallbacks {
  return {
    onPhaseChange: vi.fn(),
    onFocusWhatNext: vi.fn(),
    onFocusRecentRuns: vi.fn(),
    onFocusReadinessGate: vi.fn(),
    onToggleHelp: vi.fn()
  }
}

describe('usePlanningKeyboardShortcuts', () => {
  let container: HTMLDivElement
  let callbacks: PlanningKeyboardShortcutCallbacks

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    callbacks = createCallbacks()
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  function renderShortcuts(cb?: PlanningKeyboardShortcutCallbacks) {
    const ref = { current: container }
    return renderHook(() => usePlanningKeyboardShortcuts(ref, cb ?? callbacks))
  }

  function fireKey(key: string, opts?: Partial<KeyboardEventInit>) {
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, ...opts })
    )
  }

  it('1 key triggers onPhaseChange("analysis")', () => {
    renderShortcuts()
    fireKey('1')
    expect(callbacks.onPhaseChange).toHaveBeenCalledWith('analysis')
  })

  it('2 key triggers onPhaseChange("planning")', () => {
    renderShortcuts()
    fireKey('2')
    expect(callbacks.onPhaseChange).toHaveBeenCalledWith('planning')
  })

  it('3 key triggers onPhaseChange("solutioning")', () => {
    renderShortcuts()
    fireKey('3')
    expect(callbacks.onPhaseChange).toHaveBeenCalledWith('solutioning')
  })

  it('N key triggers onFocusWhatNext', () => {
    renderShortcuts()
    fireKey('N')
    expect(callbacks.onFocusWhatNext).toHaveBeenCalled()
  })

  it('R key triggers onFocusRecentRuns', () => {
    renderShortcuts()
    fireKey('R')
    expect(callbacks.onFocusRecentRuns).toHaveBeenCalled()
  })

  it('G key triggers onFocusReadinessGate', () => {
    renderShortcuts()
    fireKey('G')
    expect(callbacks.onFocusReadinessGate).toHaveBeenCalled()
  })

  it('? key triggers onToggleHelp', () => {
    renderShortcuts()
    fireKey('?')
    expect(callbacks.onToggleHelp).toHaveBeenCalled()
  })

  it('shortcuts do NOT fire when target is INPUT element', () => {
    renderShortcuts()
    const input = document.createElement('input')
    container.appendChild(input)
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    )
    expect(callbacks.onFocusWhatNext).not.toHaveBeenCalled()
    container.removeChild(input)
  })

  it('shortcuts do NOT fire when target is TEXTAREA element', () => {
    renderShortcuts()
    const textarea = document.createElement('textarea')
    container.appendChild(textarea)
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'r', bubbles: true })
    )
    expect(callbacks.onFocusRecentRuns).not.toHaveBeenCalled()
    container.removeChild(textarea)
  })

  it('shortcuts do NOT fire when Ctrl modifier is held', () => {
    renderShortcuts()
    fireKey('1', { ctrlKey: true })
    expect(callbacks.onPhaseChange).not.toHaveBeenCalled()
  })

  it('shortcuts do NOT fire when Cmd (meta) modifier is held', () => {
    renderShortcuts()
    fireKey('n', { metaKey: true })
    expect(callbacks.onFocusWhatNext).not.toHaveBeenCalled()
  })

  it('shortcuts do NOT fire when Alt modifier is held', () => {
    renderShortcuts()
    fireKey('g', { altKey: true })
    expect(callbacks.onFocusReadinessGate).not.toHaveBeenCalled()
  })

  it('shortcuts are case-insensitive (both n and N work)', () => {
    renderShortcuts()
    fireKey('n')
    expect(callbacks.onFocusWhatNext).toHaveBeenCalledTimes(1)
    fireKey('N')
    expect(callbacks.onFocusWhatNext).toHaveBeenCalledTimes(2)
  })

  it('cleans up listener on unmount', () => {
    const { unmount } = renderShortcuts()
    unmount()
    fireKey('1')
    expect(callbacks.onPhaseChange).not.toHaveBeenCalled()
  })

  it('does not fire for unrecognized keys', () => {
    renderShortcuts()
    fireKey('x')
    expect(callbacks.onPhaseChange).not.toHaveBeenCalled()
    expect(callbacks.onFocusWhatNext).not.toHaveBeenCalled()
    expect(callbacks.onFocusRecentRuns).not.toHaveBeenCalled()
    expect(callbacks.onFocusReadinessGate).not.toHaveBeenCalled()
    expect(callbacks.onToggleHelp).not.toHaveBeenCalled()
  })
})
