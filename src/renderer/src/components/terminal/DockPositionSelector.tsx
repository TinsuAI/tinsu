import { useCallback } from 'react'
import {
  PanelTop,
  PanelBottom,
  PanelLeft,
  PanelRight
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useTerminalStore, type DockPosition } from '@renderer/stores/terminal.store'

interface PositionOption {
  position: DockPosition
  label: string
  Icon: typeof PanelTop
}

const POSITIONS: PositionOption[] = [
  { position: 'top', label: 'Top', Icon: PanelTop },
  { position: 'bottom', label: 'Bottom', Icon: PanelBottom },
  { position: 'left', label: 'Left', Icon: PanelLeft },
  { position: 'right', label: 'Right', Icon: PanelRight }
]

interface DockPositionSelectorProps {
  /** Whether to use vertical layout (for left/right dock positions) */
  vertical?: boolean
}

/**
 * DockPositionSelector - Button group for terminal dock position.
 *
 * Features:
 * - 4 distinct buttons for each dock position
 * - Clear visual feedback with glow effects
 * - Works in both horizontal and vertical layouts
 * - Accessible with proper ARIA attributes
 */
export function DockPositionSelector({ vertical = false }: DockPositionSelectorProps): React.JSX.Element {
  const { dockPosition, setDockPosition } = useTerminalStore()

  const handleSelect = useCallback(
    (position: DockPosition) => {
      setDockPosition(position)
    },
    [setDockPosition]
  )

  return (
    <div
      className={cn(
        'dock-position-buttons',
        vertical && 'dock-position-buttons-vertical'
      )}
      role="radiogroup"
      aria-label="Terminal dock position"
    >
      {POSITIONS.map(({ position, label, Icon }) => (
        <button
          key={position}
          type="button"
          role="radio"
          aria-checked={dockPosition === position}
          aria-label={`Dock to ${label}`}
          title={`Dock to ${label}`}
          onClick={() => handleSelect(position)}
          className={cn(
            'dock-position-btn',
            dockPosition === position && 'dock-position-btn-active'
          )}
        >
          <Icon size={16} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  )
}
