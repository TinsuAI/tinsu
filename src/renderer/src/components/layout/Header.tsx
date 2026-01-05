import { cn } from '@renderer/lib/utils'

interface HeaderProps {
  className?: string
}

export function Header({ className }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-12 w-full items-center border-b border-border bg-background px-4',
        className
      )}
    >
      <h1 className="text-lg font-semibold text-foreground">TinSu</h1>
      {/* Placeholder for future project selector dropdown */}
      <div className="ml-auto" />
    </header>
  )
}
