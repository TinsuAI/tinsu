import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ArtifactDetectorService } from './artifact-detector.service'

// Mock fs module
vi.mock('fs')

describe('ArtifactDetectorService', () => {
  const mockProjectPath = '/test/project'
  const artifactsDir = path.join(mockProjectPath, '_bmad-output', 'planning-artifacts')

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('detectExistingArtifacts', () => {
    it('detects product-brief artifact (phase 1)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'product-brief-project-2026-01-01.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.has(1)).toBe(true)
      expect(result.get(1)).toBe(path.join(artifactsDir, 'product-brief-project-2026-01-01.md'))
    })

    it('detects prd artifact (phase 2)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'prd.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.has(2)).toBe(true)
      expect(result.get(2)).toBe(path.join(artifactsDir, 'prd.md'))
    })

    it('detects architecture artifact (phase 3)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'architecture.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.has(3)).toBe(true)
      expect(result.get(3)).toBe(path.join(artifactsDir, 'architecture.md'))
    })

    it('detects ux-design artifact (phase 4)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'ux-design-specification.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.has(4)).toBe(true)
      expect(result.get(4)).toBe(path.join(artifactsDir, 'ux-design-specification.md'))
    })

    it('detects ux artifact with alternative pattern (phase 4)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'project-ux.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.has(4)).toBe(true)
      expect(result.get(4)).toBe(path.join(artifactsDir, 'project-ux.md'))
    })

    it('detects epics artifact (phase 5)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'epics.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.has(5)).toBe(true)
      expect(result.get(5)).toBe(path.join(artifactsDir, 'epics.md'))
    })

    it('returns empty map when artifacts directory is missing', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.size).toBe(0)
      expect(fs.readdirSync).not.toHaveBeenCalled()
    })

    it('handles partial artifacts (some present, some missing)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'product-brief-test.md',
        'architecture.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.size).toBe(2)
      expect(result.has(1)).toBe(true) // product-brief
      expect(result.has(2)).toBe(false) // prd - missing
      expect(result.has(3)).toBe(true) // architecture
      expect(result.has(4)).toBe(false) // ux - missing
      expect(result.has(5)).toBe(false) // epics - missing
    })

    it('detects all 5 artifacts when all present', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'product-brief-project.md',
        'prd.md',
        'architecture.md',
        'ux-design.md',
        'epics.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.size).toBe(5)
      for (let i = 1; i <= 5; i++) {
        expect(result.has(i as 1 | 2 | 3 | 4 | 5)).toBe(true)
      }
    })

    it('is case-insensitive for file matching', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'PRODUCT-BRIEF.MD',
        'PRD.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.has(1)).toBe(true)
      expect(result.has(2)).toBe(true)
    })

    it('ignores non-matching files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'readme.md',
        'notes.txt',
        'something-else.md'
      ] as unknown as ReturnType<typeof fs.readdirSync>)

      const result = ArtifactDetectorService.detectExistingArtifacts(mockProjectPath)

      expect(result.size).toBe(0)
    })
  })
})
