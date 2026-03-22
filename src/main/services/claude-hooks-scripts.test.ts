/**
 * Claude Code Hook Scripts Tests - TES-2.4
 *
 * Integration tests for the Claude Code hook scripts (task-completion.sh and log-tool-use.sh)
 * and the settings.json hook configuration.
 *
 * @see TES-2.4: Claude Code Hook Scripts
 * @see TES-2.3: Hook Listener HTTP Server
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import * as http from 'http'

/** Path to the project root */
const PROJECT_ROOT = path.resolve(__dirname, '../../..')

/** Paths to hook scripts */
const TASK_COMPLETION_SCRIPT = path.join(PROJECT_ROOT, '.claude/hooks/task-completion.sh')
const LOG_TOOL_USE_SCRIPT = path.join(PROJECT_ROOT, '.claude/hooks/log-tool-use.sh')
const SETTINGS_JSON = path.join(PROJECT_ROOT, '.claude/settings.json')

/** Port file path (same as in HookListenerService) */
const PORT_FILE = '/tmp/tinsu-hook-port'

describe('Claude Code Hook Scripts (TES-2.4)', () => {
  describe('Script files existence and executability', () => {
    it('task-completion.sh should exist', () => {
      expect(fs.existsSync(TASK_COMPLETION_SCRIPT)).toBe(true)
    })

    it('task-completion.sh should be executable', () => {
      const stats = fs.statSync(TASK_COMPLETION_SCRIPT)
      // Check if at least one execute bit is set (owner, group, or other)
      const isExecutable = (stats.mode & 0o111) !== 0
      expect(isExecutable).toBe(true)
    })

    it('task-completion.sh should have bash shebang', () => {
      const content = fs.readFileSync(TASK_COMPLETION_SCRIPT, 'utf-8')
      expect(content.startsWith('#!/bin/bash')).toBe(true)
    })

    it('task-completion.sh should use curl with POST method', () => {
      const content = fs.readFileSync(TASK_COMPLETION_SCRIPT, 'utf-8')
      expect(content).toContain('curl')
      expect(content).toContain('-X POST')
    })

    it('task-completion.sh should send to /api/hooks/stop endpoint', () => {
      const content = fs.readFileSync(TASK_COMPLETION_SCRIPT, 'utf-8')
      expect(content).toContain('/api/hooks/stop')
    })

    it('task-completion.sh should set Content-Type header', () => {
      const content = fs.readFileSync(TASK_COMPLETION_SCRIPT, 'utf-8')
      expect(content).toContain('Content-Type: application/json')
    })

    it('task-completion.sh should read from stdin', () => {
      const content = fs.readFileSync(TASK_COMPLETION_SCRIPT, 'utf-8')
      expect(content).toContain('$(cat)')
    })

    it('task-completion.sh should read port from port file with fallback', () => {
      const content = fs.readFileSync(TASK_COMPLETION_SCRIPT, 'utf-8')
      expect(content).toContain('/tmp/tinsu-hook-port')
      expect(content).toContain('|| echo "3847"')
    })

    it('task-completion.sh should fail silently', () => {
      const content = fs.readFileSync(TASK_COMPLETION_SCRIPT, 'utf-8')
      expect(content).toContain('|| true')
    })

    it('log-tool-use.sh should exist', () => {
      expect(fs.existsSync(LOG_TOOL_USE_SCRIPT)).toBe(true)
    })

    it('log-tool-use.sh should be executable', () => {
      const stats = fs.statSync(LOG_TOOL_USE_SCRIPT)
      const isExecutable = (stats.mode & 0o111) !== 0
      expect(isExecutable).toBe(true)
    })

    it('log-tool-use.sh should have bash shebang', () => {
      const content = fs.readFileSync(LOG_TOOL_USE_SCRIPT, 'utf-8')
      expect(content.startsWith('#!/bin/bash')).toBe(true)
    })

    it('log-tool-use.sh should use curl with POST method', () => {
      const content = fs.readFileSync(LOG_TOOL_USE_SCRIPT, 'utf-8')
      expect(content).toContain('curl')
      expect(content).toContain('-X POST')
    })

    it('log-tool-use.sh should send to /api/hooks/tool-use endpoint', () => {
      const content = fs.readFileSync(LOG_TOOL_USE_SCRIPT, 'utf-8')
      expect(content).toContain('/api/hooks/tool-use')
    })

    it('log-tool-use.sh should set Content-Type header', () => {
      const content = fs.readFileSync(LOG_TOOL_USE_SCRIPT, 'utf-8')
      expect(content).toContain('Content-Type: application/json')
    })

    it('log-tool-use.sh should read from stdin', () => {
      const content = fs.readFileSync(LOG_TOOL_USE_SCRIPT, 'utf-8')
      expect(content).toContain('$(cat)')
    })

    it('log-tool-use.sh should read port from port file with fallback', () => {
      const content = fs.readFileSync(LOG_TOOL_USE_SCRIPT, 'utf-8')
      expect(content).toContain('/tmp/tinsu-hook-port')
      expect(content).toContain('|| echo "3847"')
    })

    it('log-tool-use.sh should fail silently', () => {
      const content = fs.readFileSync(LOG_TOOL_USE_SCRIPT, 'utf-8')
      expect(content).toContain('|| true')
    })
  })

  describe('settings.json configuration', () => {
    it('settings.json should exist', () => {
      expect(fs.existsSync(SETTINGS_JSON)).toBe(true)
    })

    it('settings.json should be valid JSON', () => {
      const content = fs.readFileSync(SETTINGS_JSON, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })

    it('settings.json should have hooks section', () => {
      const content = fs.readFileSync(SETTINGS_JSON, 'utf-8')
      const settings = JSON.parse(content)
      expect(settings).toHaveProperty('hooks')
    })

    it('settings.json should have Stop hook configuration', () => {
      const content = fs.readFileSync(SETTINGS_JSON, 'utf-8')
      const settings = JSON.parse(content)
      expect(settings.hooks).toHaveProperty('Stop')
      expect(Array.isArray(settings.hooks.Stop)).toBe(true)
      expect(settings.hooks.Stop.length).toBeGreaterThan(0)
    })

    it('settings.json Stop hook should point to task-completion.sh', () => {
      const content = fs.readFileSync(SETTINGS_JSON, 'utf-8')
      const settings = JSON.parse(content)
      const stopHook = settings.hooks.Stop[0]
      expect(stopHook).toHaveProperty('hooks')
      const commands = stopHook.hooks.map((h: { command: string }) => h.command)
      const hasTaskCompletionScript = commands.some((cmd: string) =>
        cmd.includes('task-completion.sh')
      )
      expect(hasTaskCompletionScript).toBe(true)
    })

    it('settings.json should have PostToolUse hook configuration', () => {
      const content = fs.readFileSync(SETTINGS_JSON, 'utf-8')
      const settings = JSON.parse(content)
      expect(settings.hooks).toHaveProperty('PostToolUse')
      expect(Array.isArray(settings.hooks.PostToolUse)).toBe(true)
      expect(settings.hooks.PostToolUse.length).toBeGreaterThan(0)
    })

    it('settings.json PostToolUse hook should point to log-tool-use.sh', () => {
      const content = fs.readFileSync(SETTINGS_JSON, 'utf-8')
      const settings = JSON.parse(content)
      const postToolUseHook = settings.hooks.PostToolUse[0]
      expect(postToolUseHook).toHaveProperty('hooks')
      const commands = postToolUseHook.hooks.map((h: { command: string }) => h.command)
      const hasLogToolUseScript = commands.some((cmd: string) =>
        cmd.includes('log-tool-use.sh')
      )
      expect(hasLogToolUseScript).toBe(true)
    })
  })

  describe('Script silent failure (TinSu not running)', () => {
    beforeEach(() => {
      // Ensure port file doesn't exist (no server running)
      if (fs.existsSync(PORT_FILE)) {
        fs.unlinkSync(PORT_FILE)
      }
    })

    afterEach(() => {
      // Clean up port file
      if (fs.existsSync(PORT_FILE)) {
        fs.unlinkSync(PORT_FILE)
      }
    })

    it('task-completion.sh should exit 0 when TinSu not running', () => {
      const payload = JSON.stringify({
        session_id: 'test-session',
        transcript_path: '/tmp/test.json',
        cwd: '/tmp',
        hook_event_name: 'Stop'
      })

      // Execute script with payload piped to stdin
      // Script should not throw and exit 0
      expect(() => {
        execSync(`echo '${payload}' | bash ${TASK_COMPLETION_SCRIPT}`, {
          timeout: 10000,
          stdio: 'pipe'
        })
      }).not.toThrow()
    })

    it('log-tool-use.sh should exit 0 when TinSu not running', () => {
      const payload = JSON.stringify({
        session_id: 'test-session',
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/test.ts' },
        hook_event_name: 'PostToolUse'
      })

      expect(() => {
        execSync(`echo '${payload}' | bash ${LOG_TOOL_USE_SCRIPT}`, {
          timeout: 10000,
          stdio: 'pipe'
        })
      }).not.toThrow()
    })

    it('task-completion.sh should use fallback port when port file is empty', () => {
      // Create empty port file
      fs.writeFileSync(PORT_FILE, '')

      const payload = JSON.stringify({
        session_id: 'empty-port-test',
        transcript_path: '/tmp/test.json',
        cwd: '/tmp',
        hook_event_name: 'Stop'
      })

      // Script should exit 0 (using fallback port 3847, which likely isn't running)
      expect(() => {
        execSync(`echo '${payload}' | bash ${TASK_COMPLETION_SCRIPT}`, {
          timeout: 10000,
          stdio: 'pipe'
        })
      }).not.toThrow()
    })

    it('log-tool-use.sh should use fallback port when port file is empty', () => {
      // Create empty port file
      fs.writeFileSync(PORT_FILE, '')

      const payload = JSON.stringify({
        session_id: 'empty-port-test',
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/test.ts' },
        hook_event_name: 'PostToolUse'
      })

      // Script should exit 0 (using fallback port 3847, which likely isn't running)
      expect(() => {
        execSync(`echo '${payload}' | bash ${LOG_TOOL_USE_SCRIPT}`, {
          timeout: 10000,
          stdio: 'pipe'
        })
      }).not.toThrow()
    })
  })

  describe('Script HTTP integration', () => {
    it('task-completion.sh should send valid Stop hook request', async () => {
      const testPort = 38951
      let requestReceived = false
      let receivedPayload: unknown = null

      // Start HTTP server
      const server = http.createServer((req, res) => {
        if (req.url === '/api/hooks/stop' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            requestReceived = true
            receivedPayload = JSON.parse(body)
            res.writeHead(200)
            res.end(JSON.stringify({ received: true }))
          })
        } else {
          res.writeHead(404)
          res.end()
        }
      })

      await new Promise<void>((resolve, reject) => {
        server.on('error', reject)
        server.listen(testPort, '127.0.0.1', () => resolve())
      })

      // Write port file
      fs.writeFileSync(PORT_FILE, String(testPort))

      const payload = {
        session_id: 'stop-test',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      try {
        execSync(
          `echo '${JSON.stringify(payload)}' | bash ${TASK_COMPLETION_SCRIPT}`,
          { timeout: 15000, stdio: 'pipe', encoding: 'utf-8' }
        )

        // Wait for the async request to complete
        await new Promise((resolve) => setTimeout(resolve, 300))

        expect(requestReceived).toBe(true)
        expect(receivedPayload).toEqual(payload)
      } finally {
        server.close()
        if (fs.existsSync(PORT_FILE)) {
          fs.unlinkSync(PORT_FILE)
        }
      }
    }, 20000)

    it('log-tool-use.sh should send valid PostToolUse hook request', async () => {
      const testPort = 38952
      let requestReceived = false
      let receivedPayload: unknown = null

      const server = http.createServer((req, res) => {
        if (req.url === '/api/hooks/tool-use' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            requestReceived = true
            receivedPayload = JSON.parse(body)
            res.writeHead(200)
            res.end(JSON.stringify({ received: true }))
          })
        } else {
          res.writeHead(404)
          res.end()
        }
      })

      await new Promise<void>((resolve, reject) => {
        server.on('error', reject)
        server.listen(testPort, '127.0.0.1', () => resolve())
      })

      fs.writeFileSync(PORT_FILE, String(testPort))

      const payload = {
        session_id: 'tool-test',
        tool_name: 'Edit',
        tool_input: { file_path: '/tmp/test.ts', content: 'test content' },
        hook_event_name: 'PostToolUse'
      }

      try {
        execSync(
          `echo '${JSON.stringify(payload)}' | bash ${LOG_TOOL_USE_SCRIPT}`,
          { timeout: 15000, stdio: 'pipe', encoding: 'utf-8' }
        )

        await new Promise((resolve) => setTimeout(resolve, 300))

        expect(requestReceived).toBe(true)
        expect(receivedPayload).toEqual(payload)
      } finally {
        server.close()
        if (fs.existsSync(PORT_FILE)) {
          fs.unlinkSync(PORT_FILE)
        }
      }
    }, 20000)
  })
})
