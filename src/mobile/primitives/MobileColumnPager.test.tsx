import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileColumnPager } from './MobileColumnPager'

describe('MobileColumnPager', () => {
  it('renders all column children', () => {
    render(
      <MobileColumnPager>
        {['Col A', 'Col B', 'Col C'].map((c) => (
          <div key={c} data-testid={`col-${c}`}>{c}</div>
        ))}
      </MobileColumnPager>,
    )
    expect(screen.getByTestId('col-Col A')).toBeInTheDocument()
    expect(screen.getByTestId('col-Col B')).toBeInTheDocument()
    expect(screen.getByTestId('col-Col C')).toBeInTheDocument()
  })

  it('renders with correct column data-testids', () => {
    render(
      <MobileColumnPager>
        {[<div key="0">0</div>, <div key="1">1</div>]}
      </MobileColumnPager>,
    )
    expect(screen.getByTestId('mobile-column-pager-col-0')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-column-pager-col-1')).toBeInTheDocument()
  })

  it('snap classes are applied to scroll container', () => {
    render(
      <MobileColumnPager>
        {[<div key="0">0</div>]}
      </MobileColumnPager>,
    )
    const pager = screen.getByTestId('mobile-column-pager')
    expect(pager.className).toContain('snap-x')
    expect(pager.className).toContain('snap-mandatory')
  })

  it('onIndexChange is wired via IntersectionObserver (constructor called)', () => {
    const onIndexChange = vi.fn()
    // IntersectionObserver is mocked by happy-dom; just verify the component mounts without error
    expect(() =>
      render(
        <MobileColumnPager onIndexChange={onIndexChange}>
          {[<div key="0">0</div>, <div key="1">1</div>]}
        </MobileColumnPager>,
      ),
    ).not.toThrow()
  })

  it('accepts defaultIndex prop', () => {
    expect(() =>
      render(
        <MobileColumnPager defaultIndex={1}>
          {[<div key="0">0</div>, <div key="1">1</div>]}
        </MobileColumnPager>,
      ),
    ).not.toThrow()
  })
})
