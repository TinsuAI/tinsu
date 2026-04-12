import React from 'react'
import { cn } from '@renderer/lib/utils'
import { CodeBlock } from '@renderer/components/ui/code-block'

/**
 * Shared markdown components for ReactMarkdown.
 * Used in TaskDetailContent for both quad-pane and tabbed layouts.
 */
export const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-6 mt-10 text-2xl font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-4 mt-8 text-xl font-semibold tracking-tight text-foreground">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-3 mt-6 text-lg font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-2 mt-4 text-base font-medium text-foreground">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 leading-7 text-foreground/90">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-4 ml-6 list-disc space-y-2 text-foreground/90">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-2 text-foreground/90">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-7">{children}</li>,
  input: ({ type, checked }: { type?: string; checked?: boolean }) =>
    type === 'checkbox' ? (
      <span
        className={cn(
          'mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          checked
            ? 'border-cyan-500 bg-cyan-500 text-white'
            : 'border-muted-foreground/50 bg-transparent'
        )}
        aria-checked={checked}
        role="checkbox"
      >
        {checked && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6L5 9L10 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    ) : null,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-4 border-l-4 border-cyan-500/50 pl-4 italic text-foreground/70">
      {children}
    </blockquote>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(className || '')
    const language = match ? match[1] : ''
    const codeString = String(children || '').replace(/\n$/, '')
    const isInline = !className && !codeString.includes('\n')

    if (isInline) {
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-cyan-600 dark:text-cyan-400">
          {children}
        </code>
      )
    }

    return <CodeBlock language={language} code={codeString} />
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  hr: () => <hr className="my-8 border-border/30" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-border bg-muted/30">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-2 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-border/30 px-4 py-2 text-foreground/90">{children}</td>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-600 dark:text-cyan-400 underline decoration-cyan-600/30 dark:decoration-cyan-400/30 underline-offset-2 transition-colors hover:text-cyan-500 dark:hover:text-cyan-300 hover:decoration-cyan-500/50 dark:hover:decoration-cyan-300/50"
    >
      {children}
    </a>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-foreground/90">{children}</em>
  )
}
