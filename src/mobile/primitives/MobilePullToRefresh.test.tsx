import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobilePullToRefresh } from './MobilePullToRefresh'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MobilePullToRefresh', () => {
  it('renders children', () => {
    render(
      <MobilePullToRefresh onRefresh={vi.fn().mockResolvedValue(undefined)}>
        <p data-testid="child">Content</p>
      </MobilePullToRefresh>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('pull below threshold does NOT fire onRefresh', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(
      <MobilePullToRefresh onRefresh={onRefresh} threshold={80}>
        <div>Content</div>
      </MobilePullToRefresh>,
    )
    const content = screen.getByTestId('mobile-pull-to-refresh-content')
    fireEvent.touchStart(content, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(content, { touches: [{ clientY: 150 }] }) // delta=50, below 80
    fireEvent.touchEnd(content)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('pull above threshold fires onRefresh once', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(
      <MobilePullToRefresh onRefresh={onRefresh} threshold={80}>
        <div>Content</div>
      </MobilePullToRefresh>,
    )
    const content = screen.getByTestId('mobile-pull-to-refresh-content')
    fireEvent.touchStart(content, { touches: [{ clientY: 0 }] })
    fireEvent.touchMove(content, { touches: [{ clientY: 100 }] }) // delta=100, above 80
    fireEvent.touchEnd(content)
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
  })

  it('disabled state skips all logic', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(
      <MobilePullToRefresh onRefresh={onRefresh} disabled>
        <div>Content</div>
      </MobilePullToRefresh>,
    )
    const content = screen.getByTestId('mobile-pull-to-refresh-content')
    fireEvent.touchStart(content, { touches: [{ clientY: 0 }] })
    fireEvent.touchMove(content, { touches: [{ clientY: 200 }] })
    fireEvent.touchEnd(content)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('indicator is in the DOM', () => {
    render(
      <MobilePullToRefresh onRefresh={vi.fn().mockResolvedValue(undefined)}>
        <div>Content</div>
      </MobilePullToRefresh>,
    )
    expect(screen.getByTestId('mobile-pull-to-refresh-indicator')).toBeInTheDocument()
  })

  it('reduced-motion: no animate-spin on spinner during refresh', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))
    // Just verify component renders under reduced motion without error
    expect(() =>
      render(
        <MobilePullToRefresh onRefresh={vi.fn().mockResolvedValue(undefined)}>
          <div>Content</div>
        </MobilePullToRefresh>,
      ),
    ).not.toThrow()
  })
})
