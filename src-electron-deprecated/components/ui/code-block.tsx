import { useState, useCallback } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Check, Copy } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface CodeBlockProps {
  language: string
  code: string
}

/**
 * Code block component with syntax highlighting and copy button.
 * Theme-aware: uses oneDark for dark mode, oneLight for light mode.
 */
export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const isDark = document.documentElement.classList.contains('dark')
  const baseStyle = isDark ? oneDark : oneLight

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  const customStyle = {
    ...baseStyle,
    'pre[class*="language-"]': {
      ...baseStyle['pre[class*="language-"]'],
      background: 'transparent',
      margin: 0,
      padding: 0
    },
    'code[class*="language-"]': {
      ...baseStyle['code[class*="language-"]'],
      background: 'transparent'
    }
  }

  return (
    <div className={cn(
      "group relative my-4 overflow-hidden rounded-lg border border-border/30",
      isDark ? "bg-[#1a1b26]" : "bg-[#f8f7f5]"
    )}>
      <div className={cn(
        "flex items-center justify-between border-b border-border/20 px-4 py-2",
        isDark ? "bg-[#1a1b26]" : "bg-[#f0eeeb]"
      )}>
        <span className="text-xs font-medium text-muted-foreground">{language || 'plaintext'}</span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
            copied
              ? 'text-emerald-500'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <SyntaxHighlighter
          style={customStyle}
          language={language || 'text'}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.7'
          }}
          codeTagProps={{
            style: {
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace'
            }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
