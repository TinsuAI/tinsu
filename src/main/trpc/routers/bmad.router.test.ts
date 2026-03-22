import { describe, it, expect, vi } from 'vitest'

// Mock electron
vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }))

// Mock child_process
vi.mock('child_process', () => ({ exec: vi.fn(), spawn: vi.fn() }))

// Mock BmadInstallService
vi.mock('../../services/bmad-install.service', () => ({
  BmadInstallService: {
    checkNodejs: vi.fn(),
    installNodejs: vi.fn(),
    checkBmadStatus: vi.fn(),
    installBmad: vi.fn(),
    updateBmad: vi.fn()
  }
}))

// Mock ProjectService
vi.mock('../../services/project.service', () => ({
  ProjectService: {
    getCurrentProject: vi.fn().mockReturnValue('/test/project')
  }
}))

import { bmadRouter } from './bmad.router'
import { BmadInstallService } from '../../services/bmad-install.service'
import { router } from '../trpc'
import type { Context } from '../context'

const testRouter = router({
  bmad: bmadRouter
})

function createTestContext(): Context {
  return {
    projectRoot: '/test/project',
    db: {} as Context['db'],
    projectId: null,
    activityLogService: {} as Context['activityLogService'],
    hookListenerService: {} as Context['hookListenerService']
  }
}

describe('bmadRouter', () => {
  describe('bmad.checkNodejs', () => {
    it('should return node status', async () => {
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: true,
        version: 'v20.0.0'
      })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.checkNodejs()

      expect(result).toEqual({ installed: true, version: 'v20.0.0' })
      expect(BmadInstallService.checkNodejs).toHaveBeenCalled()
    })
  })

  describe('bmad.checkStatus', () => {
    it('should return BMAD status for current project', async () => {
      vi.mocked(BmadInstallService.checkBmadStatus).mockResolvedValue({
        installed: true,
        version: '6.2.0',
        modules: ['core', 'bmm']
      })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.checkStatus()

      expect(result).toEqual({
        installed: true,
        version: '6.2.0',
        modules: ['core', 'bmm']
      })
      expect(BmadInstallService.checkBmadStatus).toHaveBeenCalledWith('/test/project')
    })
  })

  describe('bmad.availableModules', () => {
    it('should return available modules, tools, and languages', async () => {
      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.availableModules()

      expect(result.modules).toHaveLength(6)
      expect(result.modules[0].id).toBe('core')
      expect(result.tools).toHaveLength(3)
      expect(result.languages).toContain('English')
    })
  })

  describe('bmad.installNodejs', () => {
    it('should call BmadInstallService.installNodejs', async () => {
      vi.mocked(BmadInstallService.installNodejs).mockResolvedValue({ success: true })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.installNodejs()

      expect(result).toEqual({ success: true })
      expect(BmadInstallService.installNodejs).toHaveBeenCalled()
    })
  })

  describe('bmad.install', () => {
    it('should install BMAD to current project', async () => {
      vi.mocked(BmadInstallService.installBmad).mockResolvedValue({ success: true })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.install({
        modules: ['core', 'bmm'],
        tools: ['claude-code'],
        userName: 'Test User',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output'
      })

      expect(result).toEqual({ success: true })
      expect(BmadInstallService.installBmad).toHaveBeenCalledWith('/test/project', {
        modules: ['core', 'bmm'],
        tools: ['claude-code'],
        userName: 'Test User',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output'
      })
    })
  })

  describe('bmad.installToPath', () => {
    it('should install BMAD to specified path', async () => {
      vi.mocked(BmadInstallService.installBmad).mockResolvedValue({ success: true })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.installToPath({
        projectPath: '/custom/path',
        modules: ['core'],
        tools: [],
        userName: 'Test User',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output'
      })

      expect(result).toEqual({ success: true })
      expect(BmadInstallService.installBmad).toHaveBeenCalledWith('/custom/path', {
        modules: ['core'],
        tools: [],
        userName: 'Test User',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output'
      })
    })
  })

  describe('bmad.update', () => {
    it('should update BMAD in current project', async () => {
      vi.mocked(BmadInstallService.updateBmad).mockResolvedValue({ success: true })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.update({
        modules: ['core', 'bmm'],
        tools: ['claude-code'],
        userName: 'Test User',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output'
      })

      expect(result).toEqual({ success: true })
      expect(BmadInstallService.updateBmad).toHaveBeenCalledWith('/test/project', {
        modules: ['core', 'bmm'],
        tools: ['claude-code'],
        userName: 'Test User',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output'
      })
    })
  })
})
