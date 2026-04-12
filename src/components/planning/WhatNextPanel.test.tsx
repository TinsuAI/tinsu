// T1.9: WhatNextPanel is stubbed pending full implementation in T1.10.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WhatNextPanel } from './WhatNextPanel'

describe('WhatNextPanel (T1.9 stub)', () => {
  it('renders placeholder', () => {
    render(<WhatNextPanel />)
    expect(screen.getByTestId('what-next-panel')).toBeDefined()
  })
})
