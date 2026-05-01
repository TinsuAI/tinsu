/**
 * useReducedMotion — reads the OS-level `prefers-reduced-motion` media query
 * and subscribes to live changes so components react without a page reload.
 *
 * UX contract (UX-DR6):
 *   - Returns `true`  → OS requested minimal motion; disable/shorten animations
 *   - Returns `false` → Normal motion permitted
 *
 * SSR / no-window safety: returns `false` when `window` is undefined so
 * server-side renders and Node.js test environments don't crash.
 *
 * Usage:
 *   const reduced = useReducedMotion()
 *   className={reduced ? 'transition-none' : 'transition-transform duration-200'}
 */
import { useState, useEffect } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function getInitial(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUERY).matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(getInitial)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mq = window.matchMedia(QUERY)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)

    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
