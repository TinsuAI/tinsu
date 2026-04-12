import { cn } from '@renderer/lib/utils'

interface MainContentProps {
  className?: string
  children?: React.ReactNode
}

export function MainContent({ className, children }: MainContentProps) {
  return (
    <main className={cn('flex min-h-0 flex-1 flex-col overflow-hidden bg-background', className)}>
      {children ?? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Ready for development</p>
        </div>
      )}
    </main>
  )
}
