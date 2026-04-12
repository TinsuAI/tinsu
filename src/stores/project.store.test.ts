import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from './project.store'

describe('useProjectStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useProjectStore.setState({
      projectPath: null,
      projectName: null
    })
  })

  describe('initial state', () => {
    it('should have null projectPath initially', () => {
      const { projectPath } = useProjectStore.getState()
      expect(projectPath).toBeNull()
    })

    it('should have null projectName initially', () => {
      const { projectName } = useProjectStore.getState()
      expect(projectName).toBeNull()
    })
  })

  describe('setProject', () => {
    it('should set the project path and name', () => {
      const { setProject } = useProjectStore.getState()

      setProject('/path/to/project', 'TestProject')

      const { projectPath, projectName } = useProjectStore.getState()
      expect(projectPath).toBe('/path/to/project')
      expect(projectName).toBe('TestProject')
    })

    it('should update existing project', () => {
      const { setProject } = useProjectStore.getState()

      setProject('/first/project', 'First')
      setProject('/second/project', 'Second')

      const { projectPath, projectName } = useProjectStore.getState()
      expect(projectPath).toBe('/second/project')
      expect(projectName).toBe('Second')
    })
  })

  describe('clearProject', () => {
    it('should clear the project path and name', () => {
      const { setProject, clearProject } = useProjectStore.getState()

      setProject('/path/to/project', 'TestProject')
      clearProject()

      const { projectPath, projectName } = useProjectStore.getState()
      expect(projectPath).toBeNull()
      expect(projectName).toBeNull()
    })
  })
})
