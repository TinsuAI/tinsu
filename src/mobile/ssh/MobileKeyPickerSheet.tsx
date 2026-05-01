/**
 * MobileKeyPickerSheet — half-snap sheet for selecting or generating an SSH key.
 *
 * AC: 11
 *
 * Cross-tree allowed:
 *   @renderer/hooks/useSshCommands — useListSshKeys (mobile-safe)
 *   @renderer/lib/utils — cn
 *
 * Token discipline:
 *   - Key icon: text-sky-400 — UX-DR9 informational-icon palette (auth identity hint)
 *   - All other: Calm Command tokens only
 *
 * Layered sheet pattern: this sheet stays OPEN while MobileGenerateKeySheet layers above it.
 * Each MobileSheet renders via an independent Radix Portal — closing the child (generate)
 * does NOT close this parent (picker). See AC 12 architectural note.
 *
 * When keys list is empty: renders only the Generate New row + subtitle (no key list).
 * While loading: renders 3× list-row skeletons inside the sheet body.
 */

import { Key, Check, Plus } from 'lucide-react'
import { useListSshKeys } from '@renderer/hooks/useSshCommands'
import { cn } from '@renderer/lib/utils'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileListItem } from '../primitives/MobileListItem'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { MobileGenerateKeySheet } from './MobileGenerateKeySheet'

interface MobileKeyPickerSheetProps {
  open: boolean
  selectedKeyName: string
  onOpenChange: (open: boolean) => void
  onKeySelect: (name: string) => void
  // Pass-through for generate key sheet (form context)
  host: string
  port: number
  username: string
  generateKeyOpen: boolean
  onGenerateKeyOpenChange: (open: boolean) => void
  onKeyGenerated: (name: string) => void
}

export function MobileKeyPickerSheet({
  open,
  selectedKeyName,
  onOpenChange,
  onKeySelect,
  host,
  port,
  username,
  generateKeyOpen,
  onGenerateKeyOpenChange,
  onKeyGenerated,
}: MobileKeyPickerSheetProps) {
  const { data: keys = [], isLoading } = useListSshKeys()

  return (
    <>
      {/* Key picker sheet — stays open while generate sheet layers above */}
      <MobileSheet
        open={open}
        onOpenChange={onOpenChange}
        snapPoint="half"
        title="Select SSH Key"
        description="Pick an existing key or generate a new one."
      >
        <div data-testid="mobile-key-picker-sheet" className="flex flex-col">
          {/* Loading state */}
          {isLoading && <MobileLoadingSkeleton variant="list-row" count={3} />}

          {/* Empty state subtitle — above Generate New row */}
          {!isLoading && keys.length === 0 && (
            <p className="text-sm text-muted-foreground px-1 pb-3">
              No keys found. Generate one to continue.
            </p>
          )}

          {/* Key rows */}
          {!isLoading && keys.map((key) => {
            const isSelected = key.name === selectedKeyName
            const truncatedPub = key.public_key.slice(0, 32) + '…'
            return (
              <MobileListItem
                key={key.name}
                // UX-DR9 informational-icon palette — auth identity hint
                leadingIcon={<Key className={cn('h-4 w-4 text-sky-400')} />}
                title={key.name}
                subtitle={truncatedPub}
                trailing={
                  isSelected ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : undefined
                }
                onPress={() => onKeySelect(key.name)}
              />
            )
          })}

          {/* Divider */}
          <div className="h-px bg-border/40 my-2" aria-hidden />

          {/* Generate New Key row */}
          <MobileListItem
            leadingIcon={<Plus className="h-4 w-4 text-muted-foreground" />}
            title="Generate New Key"
            onPress={() => onGenerateKeyOpenChange(true)}
          />
        </div>
      </MobileSheet>

      {/* Generate key sheet — layered above via independent Radix Portal (AC 12) */}
      <MobileGenerateKeySheet
        open={generateKeyOpen}
        onOpenChange={onGenerateKeyOpenChange}
        host={host}
        port={port}
        username={username}
        onSuccess={onKeyGenerated}
      />
    </>
  )
}
