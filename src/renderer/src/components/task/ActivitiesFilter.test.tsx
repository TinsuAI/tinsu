/**
 * ActivitiesFilter Component Tests
 *
 * @see TES-2.12: Activity Log Filtering (Task 1)
 * @see AC: #1, #2, #4
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivitiesFilter } from './ActivitiesFilter'

describe('ActivitiesFilter', () => {
  it('renders all filter chips', () => {
    render(<ActivitiesFilter selectedFilters={['all']} onFilterChange={vi.fn()} />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('shows "All" as selected when selectedFilters contains "all"', () => {
    render(<ActivitiesFilter selectedFilters={['all']} onFilterChange={vi.fn()} />)

    const allChip = screen.getByRole('button', { name: /all/i })
    expect(allChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows multiple chips as selected when multiple filters are in selectedFilters', () => {
    render(<ActivitiesFilter selectedFilters={['status', 'agent']} onFilterChange={vi.fn()} />)

    const statusChip = screen.getByRole('button', { name: /status/i })
    const agentChip = screen.getByRole('button', { name: /agent/i })
    const allChip = screen.getByRole('button', { name: /all/i })

    expect(statusChip).toHaveAttribute('aria-pressed', 'true')
    expect(agentChip).toHaveAttribute('aria-pressed', 'true')
    expect(allChip).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onFilterChange with ["status"] when Status chip clicked from "all" state', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['all']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('Status'))

    expect(onChange).toHaveBeenCalledWith(['status'])
  })

  it('calls onFilterChange with ["all"] when clicking All chip from specific filter', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['status', 'agent']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('All'))

    expect(onChange).toHaveBeenCalledWith(['all'])
  })

  it('adds filter to existing selection when clicking new filter chip', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['status']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('Agent'))

    expect(onChange).toHaveBeenCalledWith(['status', 'agent'])
  })

  it('removes filter when clicking already-selected chip', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['status', 'agent']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('Status'))

    expect(onChange).toHaveBeenCalledWith(['agent'])
  })

  it('defaults to ["all"] when last filter is removed', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['status']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('Status'))

    expect(onChange).toHaveBeenCalledWith(['all'])
  })

  it('renders filter label text', () => {
    render(<ActivitiesFilter selectedFilters={['all']} onFilterChange={vi.fn()} />)

    expect(screen.getByText('Filter:')).toBeInTheDocument()
  })

  it('shows Error chip as unselected when not in selectedFilters', () => {
    render(<ActivitiesFilter selectedFilters={['all']} onFilterChange={vi.fn()} />)

    const errorChip = screen.getByRole('button', { name: /error/i })
    expect(errorChip).toHaveAttribute('aria-pressed', 'false')
  })
})
