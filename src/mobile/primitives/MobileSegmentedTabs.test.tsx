import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileSegmentedTabs } from './MobileSegmentedTabs'

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open', badge: 5 },
  { id: 'done', label: 'Done' },
]

describe('MobileSegmentedTabs', () => {
  it('renders all tabs', () => {
    render(
      <MobileSegmentedTabs tabs={tabs} activeTabId="all" onTabChange={vi.fn()} />,
    )
    expect(screen.getByTestId('mobile-segmented-tab-all')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-segmented-tab-open')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-segmented-tab-done')).toBeInTheDocument()
  })

  it('active tab has aria-selected=true', () => {
    render(
      <MobileSegmentedTabs tabs={tabs} activeTabId="open" onTabChange={vi.fn()} />,
    )
    expect(screen.getByTestId('mobile-segmented-tab-open').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('mobile-segmented-tab-all').getAttribute('aria-selected')).toBe('false')
  })

  it('clicking a tab fires onTabChange with the tab id', () => {
    const onTabChange = vi.fn()
    render(
      <MobileSegmentedTabs tabs={tabs} activeTabId="all" onTabChange={onTabChange} />,
    )
    fireEvent.click(screen.getByTestId('mobile-segmented-tab-done'))
    expect(onTabChange).toHaveBeenCalledWith('done')
  })

  it('renders badge on tab with badge > 0', () => {
    render(
      <MobileSegmentedTabs tabs={tabs} activeTabId="all" onTabChange={vi.fn()} />,
    )
    expect(screen.getByTestId('mobile-segmented-tab-badge-open')).toHaveTextContent('5')
  })

  it('renders tablist and tab roles', () => {
    render(
      <MobileSegmentedTabs tabs={tabs} activeTabId="all" onTabChange={vi.fn()} />,
    )
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })
})
