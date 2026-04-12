import './globals.css'
import '@xterm/xterm/css/xterm.css'

import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, trpcClient } from './lib/trpc'
import { useThemeStore } from './stores'
import App from './App'

/**
 * Initialize theme from localStorage before React hydrates.
 * This prevents flash of wrong theme on initial load.
 */
function initializeTheme() {
  try {
    const stored = localStorage.getItem('tinsu-theme')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.state?.theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    // Default is light mode (no 'dark' class)
  } catch {
    // Default to light mode on error
  }
}

// Run immediately before React renders
initializeTheme()

function ThemeInitializer({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    // Sync theme class with store state
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return <>{children}</>
}

function Root(): React.JSX.Element {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeInitializer>
          <App />
        </ThemeInitializer>
      </QueryClientProvider>
    </trpc.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
