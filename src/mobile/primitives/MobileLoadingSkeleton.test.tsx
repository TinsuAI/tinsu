import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileLoadingSkeleton } from './MobileLoadingSkeleton'

describe('MobileLoadingSkeleton', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders text-row variant', () => {
    render(<MobileLoadingSkeleton variant="text-row" />)
    expect(screen.getByTestId('mobile-loading-skeleton-text-row')).toBeInTheDocument()
  })

  it('renders list-row variant', () => {
    render(<MobileLoadingSkeleton variant="list-row" />)
    expect(screen.getByTestId('mobile-loading-skeleton-list-row')).toBeInTheDocument()
  })

  it('renders card variant', () => {
    render(<MobileLoadingSkeleton variant="card" />)
    expect(screen.getByTestId('mobile-loading-skeleton-card')).toBeInTheDocument()
  })

  it('renders chat-bubble variant', () => {
    render(<MobileLoadingSkeleton variant="chat-bubble" />)
    expect(screen.getByTestId('mobile-loading-skeleton-chat-bubble')).toBeInTheDocument()
  })

  it('renders circle variant', () => {
    render(<MobileLoadingSkeleton variant="circle" />)
    expect(screen.getByTestId('mobile-loading-skeleton-circle')).toBeInTheDocument()
  })

  it('renders count > 1 blocks', () => {
    render(<MobileLoadingSkeleton variant="text-row" count={3} />)
    expect(screen.getAllByTestId('mobile-loading-skeleton-text-row')).toHaveLength(3)
  })

  it('drops animate-pulse class under reduced-motion', () => {
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
    render(<MobileLoadingSkeleton variant="text-row" />)
    const el = screen.getByTestId('mobile-loading-skeleton-text-row')
    expect(el.className).not.toContain('animate-pulse')
  })

  it('includes animate-pulse class when reduced-motion is false', () => {
    render(<MobileLoadingSkeleton variant="text-row" />)
    const el = screen.getByTestId('mobile-loading-skeleton-text-row')
    expect(el.className).toContain('animate-pulse')
  })
})
