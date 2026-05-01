import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileSearchBar } from './MobileSearchBar'

describe('MobileSearchBar', () => {
  it('renders with placeholder', () => {
    render(<MobileSearchBar value="" onChange={vi.fn()} placeholder="Search tasks…" />)
    expect(screen.getByPlaceholderText('Search tasks…')).toBeInTheDocument()
  })

  it('typing fires onChange with new value', () => {
    const onChange = vi.fn()
    render(<MobileSearchBar value="" onChange={onChange} />)
    const input = screen.getByTestId('mobile-search-bar-input')
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('clear button appears when value is non-empty', () => {
    render(<MobileSearchBar value="hello" onChange={vi.fn()} />)
    expect(screen.getByTestId('mobile-search-bar-clear')).toBeInTheDocument()
  })

  it('clear button fires onChange with empty string and onClear callback', () => {
    const onChange = vi.fn()
    const onClear = vi.fn()
    render(<MobileSearchBar value="hello" onChange={onChange} onClear={onClear} />)
    fireEvent.click(screen.getByTestId('mobile-search-bar-clear'))
    expect(onChange).toHaveBeenCalledWith('')
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('Enter keypress fires onSubmit with current value', () => {
    const onSubmit = vi.fn()
    render(<MobileSearchBar value="query" onChange={vi.fn()} onSubmit={onSubmit} />)
    const input = screen.getByTestId('mobile-search-bar-input')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('query')
  })

  it('clear button not rendered when value is empty', () => {
    render(<MobileSearchBar value="" onChange={vi.fn()} />)
    expect(screen.queryByTestId('mobile-search-bar-clear')).not.toBeInTheDocument()
  })
})
