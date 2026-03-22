/**
 * PersonaContextService Tests - Story 10.4 (AC: 1-5)
 *
 * Tests: buildContext returns context with persona content and config,
 * buildContext throws for unknown persona key, buildContext resolves
 * {project-root} placeholders, loadConfig caches after first load,
 * getPersonaFilePath returns correct paths, buildContext includes
 * planning artifacts path instruction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersonaContextService } from './persona-context.service'

// Mock fs module
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn()
  }
}))

// Mock yaml module
vi.mock('yaml', () => ({
  parse: vi.fn()
}))

import fs from 'fs'
import { parse as parseYaml } from 'yaml'

const mockReadFileSync = vi.mocked(fs.readFileSync)
const mockParseYaml = vi.mocked(parseYaml)

describe('PersonaContextService (Story 10.4, AC: 1-5)', () => {
  let service: PersonaContextService

  const BMAD_ROOT = '/test/project/_bmad'
  const PROJECT_ROOT = '/test/project'

  const MOCK_CONFIG = {
    user_name: 'Tinsu',
    project_name: 'TinSu',
    communication_language: 'English',
    planning_artifacts: '{project-root}/_bmad-output/planning-artifacts',
    output_folder: '{project-root}/_bmad-output'
  }

  const MOCK_PERSONA_CONTENT = '---\nname: "pm"\ndescription: "Product Manager"\n---\n\nYou are the PM.'

  beforeEach(() => {
    vi.clearAllMocks()

    service = new PersonaContextService(BMAD_ROOT, PROJECT_ROOT)

    // Default mock: config YAML
    mockReadFileSync.mockImplementation((filePath: unknown) => {
      const p = String(filePath)
      if (p.endsWith('config.yaml')) {
        return 'user_name: Tinsu\nproject_name: TinSu\n'
      }
      if (p.endsWith('.md')) {
        return MOCK_PERSONA_CONTENT
      }
      throw new Error(`Unexpected file read: ${p}`)
    })

    mockParseYaml.mockReturnValue(MOCK_CONFIG)
  })

  describe('buildContext (AC: 1, 2, 3, 4, 5)', () => {
    it('returns string containing persona file content and config values', () => {
      const context = service.buildContext('bmad:bmm:agents:pm')

      // Should contain persona instructions
      expect(context).toContain('<persona-instructions>')
      expect(context).toContain(MOCK_PERSONA_CONTENT)
      expect(context).toContain('</persona-instructions>')

      // Should contain project config
      expect(context).toContain('<project-config>')
      expect(context).toContain('Project: TinSu')
      expect(context).toContain('User: Tinsu')
      expect(context).toContain('Communication Language: English')
      expect(context).toContain('</project-config>')
    })

    it('throws for unknown persona key', () => {
      expect(() => service.buildContext('unknown:persona')).toThrow(
        'Unknown persona key: "unknown:persona"'
      )
    })

    it('resolves {project-root} placeholders in config paths', () => {
      const context = service.buildContext('bmad:bmm:agents:pm')

      // The resolved paths should contain PROJECT_ROOT, not the placeholder
      expect(context).toContain('/test/project/_bmad-output/planning-artifacts')
      expect(context).toContain('/test/project/_bmad-output')
      expect(context).not.toContain('{project-root}')
    })

    it('includes planning artifacts path instruction', () => {
      const context = service.buildContext('bmad:bmm:agents:pm')

      expect(context).toContain(
        'IMPORTANT: When producing any artifacts (PRDs, architecture docs, etc.), save them to: /test/project/_bmad-output/planning-artifacts/'
      )
    })

    it('reads correct persona file for PM (AC: 1)', () => {
      service.buildContext('bmad:bmm:agents:pm')

      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/test/project/_bmad/bmm/agents/pm.md',
        'utf-8'
      )
    })

    it('reads correct persona file for Architect (AC: 2)', () => {
      service.buildContext('bmad:bmm:agents:architect')

      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/test/project/_bmad/bmm/agents/architect.md',
        'utf-8'
      )
    })

    it('reads correct persona file for UX Designer (AC: 3)', () => {
      service.buildContext('bmad:bmm:agents:ux-designer')

      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/test/project/_bmad/bmm/agents/ux-designer.md',
        'utf-8'
      )
    })

    it('reads correct persona file for Analyst (AC: 4)', () => {
      service.buildContext('bmad:bmm:agents:analyst')

      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/test/project/_bmad/bmm/agents/analyst.md',
        'utf-8'
      )
    })

    it('includes BMAD agent acting instruction with project name from config', () => {
      const context = service.buildContext('bmad:bmm:agents:pm')

      // Uses config.project_name ('TinSu' from MOCK_CONFIG), not a hardcoded string
      expect(context).toContain(
        'You are acting as a BMAD planning agent in TinSu. Follow the persona instructions below.'
      )
    })
  })

  describe('loadConfig (AC: 5)', () => {
    it('caches config after first load — second call does not re-read file', () => {
      service.loadConfig()
      service.loadConfig()

      // config.yaml should only be read once
      const configReads = mockReadFileSync.mock.calls.filter(
        (call) => String(call[0]).endsWith('config.yaml')
      )
      expect(configReads).toHaveLength(1)
    })

    it('reads config from correct path', () => {
      service.loadConfig()

      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/test/project/_bmad/bmm/config.yaml',
        'utf-8'
      )
    })
  })

  describe('getPersonaFilePath', () => {
    it('returns correct absolute path for known persona key', () => {
      expect(service.getPersonaFilePath('bmad:bmm:agents:pm')).toBe(
        '/test/project/_bmad/bmm/agents/pm.md'
      )
      expect(service.getPersonaFilePath('bmad:bmm:agents:architect')).toBe(
        '/test/project/_bmad/bmm/agents/architect.md'
      )
      expect(service.getPersonaFilePath('bmad:bmm:agents:ux-designer')).toBe(
        '/test/project/_bmad/bmm/agents/ux-designer.md'
      )
      expect(service.getPersonaFilePath('bmad:bmm:agents:analyst')).toBe(
        '/test/project/_bmad/bmm/agents/analyst.md'
      )
    })

    it('returns null for unknown persona key', () => {
      expect(service.getPersonaFilePath('unknown:key')).toBeNull()
      expect(service.getPersonaFilePath('')).toBeNull()
    })
  })
})
