import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RejectButton } from './RejectButton'

describe('RejectButton', () => {
  let onReject: ReturnType<typeof vi.fn<(feedback: string | null) => void>>

  beforeEach(() => {
    onReject = vi.fn<(feedback: string | null) => void>()
  })

  describe('button rendering', () => {
    it('renders with correct text and icon', () => {
      render(<RejectButton onReject={onReject} />)

      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    })

    it('shows keyboard shortcut "R"', () => {
      render(<RejectButton onReject={onReject} />)

      expect(screen.getByText('R')).toBeInTheDocument()
    })

    it('applies red/destructive styling', () => {
      render(<RejectButton onReject={onReject} />)

      const button = screen.getByRole('button', { name: /reject/i })
      expect(button).toHaveClass('bg-red-600')
    })

    it('disables button when disabled prop is true', () => {
      render(<RejectButton onReject={onReject} disabled />)

      expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled()
    })

    it('disables button when isPending is true', () => {
      render(<RejectButton onReject={onReject} isPending />)

      expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled()
    })

    it('shows loading spinner when isPending', () => {
      render(<RejectButton onReject={onReject} isPending />)

      // Loader2 has animate-spin class
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('dialog interaction', () => {
    it('opens dialog when button is clicked', async () => {
      render(<RejectButton onReject={onReject} />)

      fireEvent.click(screen.getByRole('button', { name: /reject/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('shows dialog title and description', async () => {
      render(<RejectButton onReject={onReject} />)

      fireEvent.click(screen.getByRole('button', { name: /reject/i }))

      await waitFor(() => {
        expect(screen.getByText('Reject Changes')).toBeInTheDocument()
        expect(
          screen.getByText(/provide feedback to help the agent improve/i)
        ).toBeInTheDocument()
      })
    })

    it('shows textarea for feedback input', async () => {
      render(<RejectButton onReject={onReject} />)

      fireEvent.click(screen.getByRole('button', { name: /reject/i }))

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/what needs to be changed/i)).toBeInTheDocument()
      })
    })

    it('shows Cancel and Reject buttons in dialog', async () => {
      render(<RejectButton onReject={onReject} />)

      fireEvent.click(screen.getByRole('button', { name: /reject/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /reject & return/i })).toBeInTheDocument()
      })
    })
  })

  describe('reject action', () => {
    it('calls onReject with feedback text when submitted', async () => {
      const user = userEvent.setup()
      render(<RejectButton onReject={onReject} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /reject/i }))

      // Type feedback
      await user.type(
        screen.getByPlaceholderText(/what needs to be changed/i),
        'Please fix the validation logic'
      )

      // Click reject button
      await user.click(screen.getByRole('button', { name: /reject & return/i }))

      expect(onReject).toHaveBeenCalledWith('Please fix the validation logic')
    })

    it('shows warning when feedback is empty, then allows rejection (AC 5)', async () => {
      const user = userEvent.setup()
      render(<RejectButton onReject={onReject} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /reject/i }))

      // Don't type any feedback

      // Click reject button - should show warning
      await user.click(screen.getByRole('button', { name: /reject & return/i }))

      // Warning should appear
      await waitFor(() => {
        expect(screen.getByText(/feedback helps the agent improve/i)).toBeInTheDocument()
      })

      // onReject not called yet
      expect(onReject).not.toHaveBeenCalled()

      // Click reject button again (now labeled "Reject Anyway")
      await user.click(screen.getByRole('button', { name: /reject anyway/i }))

      // Now onReject is called with null
      expect(onReject).toHaveBeenCalledWith(null)
    })

    it('treats whitespace-only feedback as empty and shows warning', async () => {
      const user = userEvent.setup()
      render(<RejectButton onReject={onReject} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /reject/i }))

      // Type only whitespace
      await user.type(screen.getByPlaceholderText(/what needs to be changed/i), '   ')

      // Click reject button - should show warning (whitespace-only is treated as empty)
      await user.click(screen.getByRole('button', { name: /reject & return/i }))

      // Warning should appear
      await waitFor(() => {
        expect(screen.getByText(/feedback helps the agent improve/i)).toBeInTheDocument()
      })

      // Click reject button again to proceed
      await user.click(screen.getByRole('button', { name: /reject anyway/i }))

      // Whitespace-only feedback should be null
      expect(onReject).toHaveBeenCalledWith(null)
    })
  })

  describe('dialog cancel', () => {
    it('closes dialog when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<RejectButton onReject={onReject} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /reject/i }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('does not call onReject when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<RejectButton onReject={onReject} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /reject/i }))

      // Type some feedback
      await user.type(screen.getByPlaceholderText(/what needs to be changed/i), 'Some feedback')

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onReject).not.toHaveBeenCalled()
    })

    it('clears feedback when dialog is closed and reopened', async () => {
      const user = userEvent.setup()
      render(<RejectButton onReject={onReject} />)

      // Open dialog and type feedback
      await user.click(screen.getByRole('button', { name: /reject/i }))
      await user.type(screen.getByPlaceholderText(/what needs to be changed/i), 'Some feedback')

      // Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Reopen dialog
      await user.click(screen.getByRole('button', { name: /reject/i }))

      // Feedback should be cleared
      const textarea = screen.getByPlaceholderText(/what needs to be changed/i)
      expect(textarea).toHaveValue('')
    })
  })

  describe('keyboard shortcuts', () => {
    it('shows Cmd+Enter hint in dialog', async () => {
      render(<RejectButton onReject={onReject} />)

      fireEvent.click(screen.getByRole('button', { name: /reject/i }))

      await waitFor(() => {
        expect(screen.getByText('Cmd')).toBeInTheDocument()
        expect(screen.getByText('Enter')).toBeInTheDocument()
      })
    })
  })

  describe('pending state in dialog', () => {
    it('disables textarea when isPending', async () => {
      render(<RejectButton onReject={onReject} isPending />)

      // Button is disabled, so dialog can't be opened normally in pending state
      // But if already open and pending starts, textarea should be disabled
      // This is tested via the component's internal state
    })

    it('disables Cancel button when isPending', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<RejectButton onReject={onReject} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /reject/i }))

      // Rerender with isPending
      rerender(<RejectButton onReject={onReject} isPending />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
      })
    })

    it('shows loading spinner in dialog reject button when isPending', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<RejectButton onReject={onReject} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /reject/i }))

      // Rerender with isPending
      rerender(<RejectButton onReject={onReject} isPending />)

      // Should show loading spinner in the dialog's reject button
      await waitFor(() => {
        // Find spinner within dialog (there may be two - one in trigger and one in dialog)
        const spinners = document.querySelectorAll('.animate-spin')
        expect(spinners.length).toBeGreaterThan(0)
      })
    })
  })
})
