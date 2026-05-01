import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileScreen } from './MobileScreen'

describe('MobileScreen', () => {
  it('renders topBar, children, and tabBar', () => {
    render(
      <MobileScreen
        topBar={<div data-testid="top">TopBar</div>}
        tabBar={<div data-testid="tab">TabBar</div>}
      >
        <p>Content</p>
      </MobileScreen>,
    )
    expect(screen.getByTestId('top')).toBeInTheDocument()
    expect(screen.getByTestId('tab')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders the mobile-screen container', () => {
    render(
      <MobileScreen topBar={<div />} tabBar={<div />}>
        <div />
      </MobileScreen>,
    )
    expect(screen.getByTestId('mobile-screen')).toBeInTheDocument()
  })

  it('renders optional bottomBar slot when provided', () => {
    render(
      <MobileScreen
        topBar={<div />}
        tabBar={<div />}
        bottomBar={<div data-testid="bottom-bar">Actions</div>}
      >
        <div />
      </MobileScreen>,
    )
    expect(screen.getByTestId('bottom-bar')).toBeInTheDocument()
  })

  it('does not render bottomBar slot when not provided', () => {
    render(
      <MobileScreen topBar={<div />} tabBar={<div />}>
        <div />
      </MobileScreen>,
    )
    expect(screen.queryByTestId('bottom-bar')).not.toBeInTheDocument()
  })
})
