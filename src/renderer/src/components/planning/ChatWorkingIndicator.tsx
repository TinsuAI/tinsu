/**
 * ChatWorkingIndicator - Gen Z-style animated working/thinking indicator.
 *
 * Story 10.5: Tool Activity & Working Indicators (AC: 1)
 *
 * Shows randomized Gen Z-style messages with the BMAD agent name,
 * animated emoji, gradient text, and contextual tool activity descriptions.
 */

import { useState, useEffect, useRef } from 'react'
import { cn } from '@renderer/lib/utils'
import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'

interface ChatWorkingIndicatorProps {
  agentPersona?: string | null
  currentToolActivity?: {
    toolName: string
    toolInput: Record<string, unknown>
  } | null
}

/** Gen Z cooking phrases — {agent} gets replaced with persona name */
const COOKING_PHRASES = [
  { text: '{agent} is cooking rn', emoji: '🔥' },
  { text: '{agent} said "hold my coffee"', emoji: '☕' },
  { text: '{agent} is in their bag rn', emoji: '💅' },
  { text: '{agent} understood the assignment', emoji: '📝' },
  { text: 'no cap, {agent} is locked in', emoji: '🔒' },
  { text: '{agent} woke up and chose productivity', emoji: '⚡' },
  { text: '{agent} is lowkey goated rn', emoji: '🐐' },
  { text: '{agent} is absolutely sending it', emoji: '🚀' },
  { text: '{agent} said "bet" and went off', emoji: '💯' },
  { text: '{agent} is giving main character energy', emoji: '✨' },
  { text: 'slay incoming from {agent}', emoji: '👑' },
  { text: '{agent} is living their best life', emoji: '🌟' },
  { text: '{agent} is on a whole different level', emoji: '📈' },
  { text: '{agent} just built different fr fr', emoji: '🏗️' },
  { text: 'bestie {agent} is doing the thing', emoji: '💪' },
  { text: '{agent} ate and left no crumbs', emoji: '🍽️' },
  { text: 'it\'s giving genius from {agent}', emoji: '🧠' },
  { text: '{agent} is hitting different today', emoji: '🎯' },
  { text: '{agent} said "watch this" and went full beast', emoji: '🦁' },
  { text: 'ong {agent} is not playing around', emoji: '😤' },
  { text: '{agent} is cooking with the good stuff', emoji: '👨‍🍳' },
  { text: 'sheeeesh {agent} is in the zone', emoji: '🎶' },
  { text: '{agent} has entered god mode', emoji: '⚡' },
  { text: '{agent} is giving 110% no cap', emoji: '💎' },
  { text: '{agent} is on their grindset rn', emoji: '🔥' },
]

/** Tool-specific Gen Z phrases */
const TOOL_PHRASES: Record<string, { text: string; emoji: string }[]> = {
  Read: [
    { text: '{agent} is reading the fine print', emoji: '👀' },
    { text: '{agent} said "lemme peep this real quick"', emoji: '🔍' },
    { text: '{agent} is doing their research era', emoji: '📚' },
  ],
  Write: [
    { text: '{agent} is writing their masterpiece', emoji: '✍️' },
    { text: '{agent} is dropping bars in code', emoji: '🎤' },
    { text: '{agent} is manifesting this file into existence', emoji: '✨' },
  ],
  Edit: [
    { text: '{agent} is giving this file a glow up', emoji: '💅' },
    { text: '{agent} is remixing the code', emoji: '🎧' },
    { text: '{agent} said "this needs a vibe check"', emoji: '🔧' },
  ],
  Bash: [
    { text: '{agent} is hacking the mainframe (jk)', emoji: '💻' },
    { text: '{agent} is running commands like a boss', emoji: '⌨️' },
    { text: '{agent} is in the terminal arc', emoji: '🖥️' },
  ],
  Grep: [
    { text: '{agent} is hunting for the tea', emoji: '🔎' },
    { text: '{agent} is searching with main character energy', emoji: '🕵️' },
    { text: '{agent} is on a search quest rn', emoji: '🗺️' },
  ],
  Glob: [
    { text: '{agent} is finding all the files no cap', emoji: '📂' },
    { text: '{agent} is on file patrol rn', emoji: '🗂️' },
  ],
}

/** Pick a random item from an array, avoiding the last pick */
function pickRandom<T>(arr: readonly T[], lastIndex: number): { item: T; index: number } {
  if (arr.length <= 1) return { item: arr[0], index: 0 }
  let idx: number
  do {
    idx = Math.floor(Math.random() * arr.length)
  } while (idx === lastIndex)
  return { item: arr[idx], index: idx }
}

/** Extract basename from a file path */
function basename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filePath
}

/** Get contextual detail text for tool activity */
function getToolDetail(
  toolName: string,
  toolInput: Record<string, unknown>
): string | null {
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const fp = toolInput.file_path as string | undefined
      return fp ? basename(fp) : null
    }
    case 'Grep': {
      const pattern = toolInput.pattern as string | undefined
      return pattern ? `"${pattern}"` : null
    }
    default:
      return null
  }
}

export function ChatWorkingIndicator({
  agentPersona,
  currentToolActivity
}: ChatWorkingIndicatorProps) {
  const persona =
    agentPersona && AGENT_PERSONA_CONFIG[agentPersona]
      ? AGENT_PERSONA_CONFIG[agentPersona]
      : null

  const agentName = persona?.characterName || persona?.displayName || 'Agent'
  const roleLabel = persona?.displayName ?? 'Agent'
  const dotColor = persona?.dot ?? 'bg-muted-foreground/40'

  // Track last picked index to avoid repeats
  const lastIndexRef = useRef(-1)

  // Pick a phrase once on mount (or when tool activity changes)
  const [phrase, setPhrase] = useState<{ text: string; emoji: string }>(() => {
    const pool =
      currentToolActivity && TOOL_PHRASES[currentToolActivity.toolName]
        ? TOOL_PHRASES[currentToolActivity.toolName]
        : COOKING_PHRASES
    const { item, index } = pickRandom(pool, lastIndexRef.current)
    lastIndexRef.current = index
    return item
  })

  // Change phrase when tool activity changes
  const prevToolRef = useRef(currentToolActivity?.toolName ?? null)
  useEffect(() => {
    const currentTool = currentToolActivity?.toolName ?? null
    if (currentTool !== prevToolRef.current) {
      prevToolRef.current = currentTool
      const pool =
        currentTool && TOOL_PHRASES[currentTool]
          ? TOOL_PHRASES[currentTool]
          : COOKING_PHRASES
      const { item, index } = pickRandom(pool, lastIndexRef.current)
      lastIndexRef.current = index
      setPhrase(item)
    }
  }, [currentToolActivity?.toolName])

  // Replace {agent} placeholder with actual agent character name
  const displayText = phrase.text.replace('{agent}', agentName)

  // Tool detail (e.g., filename being read)
  const toolDetail = currentToolActivity
    ? getToolDetail(currentToolActivity.toolName, currentToolActivity.toolInput)
    : null

  return (
    <div
      className="flex items-start gap-2"
      data-testid="chat-thinking-indicator"
    >
      <div className="max-w-[85%] overflow-hidden rounded-xl rounded-tl-sm bg-muted/30 px-3 py-2.5">
        {/* Persona label */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              dotColor
            )}
            style={{
              animation: 'cooking-pulse 1.5s ease-in-out infinite',
            }}
            data-testid="working-indicator-dot"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {agentName}
          </span>
          {agentName !== roleLabel && (
            <span className="text-[9px] text-muted-foreground/35">
              ({roleLabel})
            </span>
          )}
        </div>

        {/* Gen Z phrase with animated emoji */}
        <div className="flex items-center gap-2">
          <span
            className="inline-block text-base"
            style={{
              animation: 'cooking-bounce 1s ease-in-out infinite',
            }}
          >
            {phrase.emoji}
          </span>
          <span
            className="bg-gradient-to-r bg-clip-text text-sm font-semibold text-transparent"
            style={{
              backgroundImage: persona
                ? undefined
                : 'linear-gradient(90deg, #a78bfa, #f472b6, #fb923c)',
              backgroundSize: '200% 100%',
              animation: 'cooking-gradient 3s ease-in-out infinite',
              ...(persona
                ? {
                    backgroundImage:
                      agentName === 'Mary'
                        ? 'linear-gradient(90deg, #60a5fa, #818cf8, #60a5fa)'
                        : agentName === 'John'
                          ? 'linear-gradient(90deg, #4ade80, #34d399, #4ade80)'
                          : agentName === 'Winston'
                            ? 'linear-gradient(90deg, #fb923c, #f59e0b, #fb923c)'
                            : agentName === 'Sally'
                              ? 'linear-gradient(90deg, #c084fc, #e879f9, #c084fc)'
                              : agentName === 'Greg'
                                ? 'linear-gradient(90deg, #34d399, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #a78bfa, #f472b6, #fb923c)',
                  }
                : {}),
            }}
            data-testid="working-indicator-phrase"
          >
            {displayText}
          </span>
        </div>

        {/* Tool detail subtitle */}
        {toolDetail && (
          <div className="mt-1 flex items-center gap-1.5 pl-7">
            <span className="font-mono text-[10px] text-muted-foreground/40">
              ↳ {toolDetail}
            </span>
            <span
              className="inline-block"
              style={{
                animation: 'cooking-dots 1.5s steps(4, end) infinite',
              }}
              data-testid="working-indicator-dots"
            >
              <span className="font-mono text-[10px] text-muted-foreground/30">...</span>
            </span>
          </div>
        )}

        {/* Animated progress bar */}
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-full rounded-full"
            style={{
              background: persona
                ? agentName === 'Mary'
                  ? 'linear-gradient(90deg, #60a5fa, #818cf8)'
                  : agentName === 'John'
                    ? 'linear-gradient(90deg, #4ade80, #34d399)'
                    : agentName === 'Winston'
                      ? 'linear-gradient(90deg, #fb923c, #f59e0b)'
                      : agentName === 'Sally'
                        ? 'linear-gradient(90deg, #c084fc, #e879f9)'
                        : agentName === 'Greg'
                          ? 'linear-gradient(90deg, #34d399, #10b981)'
                          : 'linear-gradient(90deg, #a78bfa, #f472b6)'
                : 'linear-gradient(90deg, #a78bfa, #f472b6)',
              animation: 'cooking-progress 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Inline keyframe styles */}
      <style>{`
        @keyframes cooking-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
        @keyframes cooking-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(-10deg); }
          75% { transform: translateY(-2px) rotate(10deg); }
        }
        @keyframes cooking-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes cooking-dots {
          0% { opacity: 0.2; }
          25% { opacity: 0.4; }
          50% { opacity: 0.7; }
          75% { opacity: 1; }
          100% { opacity: 0.2; }
        }
        @keyframes cooking-progress {
          0% { width: 0%; opacity: 0.6; }
          50% { width: 100%; opacity: 1; }
          100% { width: 0%; opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
