import { useState, useEffect } from 'react'

/**
 * Hook to detect if the screen is mobile-sized (less than 1024px, matches lg: breakpoint).
 * AC: 1 from Story t3-5
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 1024
  })

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}
