import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DevAgentProgressService, DevAgentProgressInfo } from './dev-agent-progress.service'

describe('DevAgentProgressService', () => {
  let service: DevAgentProgressService

  beforeEach(() => {
    service = new DevAgentProgressService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    service.dispose()
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('starts with idle state', () => {
      expect(service.getState()).toBe('idle')
    })

    it('returns step 0/3 when idle', () => {
      const progress = service.getCurrentStep()
      expect(progress.step).toBe(0)
      expect(progress.total).toBe(3)
    })

    it('returns "Ready" label when idle', () => {
      const progress = service.getCurrentStep()
      expect(progress.label).toBe('Ready')
    })
  })

  describe('setState', () => {
    it('transitions to dev_implementing state', () => {
      service.setState('dev_implementing')
      expect(service.getState()).toBe('dev_implementing')
    })

    it('transitions to code_reviewing state', () => {
      service.setState('code_reviewing')
      expect(service.getState()).toBe('code_reviewing')
    })

    it('transitions back to idle state', () => {
      service.setState('dev_implementing')
      service.setState('idle')
      expect(service.getState()).toBe('idle')
    })
  })

  describe('getCurrentStep', () => {
    it('returns step 2/3 for dev_implementing (DEV is step 2, SM is step 1 but skipped)', () => {
      service.setState('dev_implementing')
      const progress = service.getCurrentStep()

      // Based on story AC2: "Step 2/3: DEV Implementing"
      // SM (step 1) is typically skipped when story file already exists
      expect(progress).toEqual<DevAgentProgressInfo>({
        step: 2,
        total: 3,
        label: 'Step 2/3: DEV Implementing'
      })
    })

    it('shows DEV as step 2 during dev_implementing with correct label', () => {
      service.setState('dev_implementing')
      const progress = service.getCurrentStep()

      // Based on story: "Step 2/3: DEV Implementing"
      expect(progress.step).toBe(2)
      expect(progress.label).toBe('Step 2/3: DEV Implementing')
    })

    it('returns step 3/3 for code_reviewing', () => {
      service.setState('code_reviewing')
      const progress = service.getCurrentStep()

      expect(progress).toEqual<DevAgentProgressInfo>({
        step: 3,
        total: 3,
        label: 'Step 3/3: Code Review'
      })
    })
  })

  describe('event emission', () => {
    it('emits progress event when state changes to dev_implementing', () => {
      const listener = vi.fn()
      service.onProgress(listener)

      service.setState('dev_implementing')

      expect(listener).toHaveBeenCalledWith({
        step: 2,
        total: 3,
        label: 'Step 2/3: DEV Implementing'
      })
    })

    it('emits progress event when state changes to code_reviewing', () => {
      const listener = vi.fn()
      service.onProgress(listener)

      service.setState('code_reviewing')

      expect(listener).toHaveBeenCalledWith({
        step: 3,
        total: 3,
        label: 'Step 3/3: Code Review'
      })
    })

    it('emits progress event when state changes to idle', () => {
      const listener = vi.fn()
      service.setState('dev_implementing')
      service.onProgress(listener)

      service.setState('idle')

      expect(listener).toHaveBeenCalledWith({
        step: 0,
        total: 3,
        label: 'Ready'
      })
    })

    it('supports multiple listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      service.onProgress(listener1)
      service.onProgress(listener2)
      service.setState('dev_implementing')

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
    })

    it('returns unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = service.onProgress(listener)

      unsubscribe()
      service.setState('dev_implementing')

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('removes all listeners on dispose', () => {
      const listener = vi.fn()
      service.onProgress(listener)

      service.dispose()
      service.setState('dev_implementing')

      expect(listener).not.toHaveBeenCalled()
    })
  })
})
