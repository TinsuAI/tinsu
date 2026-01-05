import { cn } from '@renderer/lib/utils'

interface MainContentProps {
  className?: string
  children?: React.ReactNode
}

export function MainContent({ className, children }: MainContentProps) {
  return (
    <main className={cn('flex flex-1 flex-col overflow-auto bg-background', className)}>
      {children ?? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Ready for development</p>
        </div>
      )}
    </main>
  )
}
