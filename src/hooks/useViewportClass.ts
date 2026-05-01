import { useState, useEffect } from 'react'

export type ViewportClass = 'mobile' | 'desktop'

/**
 * Detects the current viewport class: 'mobile' | 'desktop'.
 *
 * Detection logic (in priority order):
 *  1. SSR / no window → 'desktop' (jsdom default; avoids hydration mismatch)
 *  2. Tauri mobile platform: window.__TAURI_INTERNALS__?.platform is 'android'|'ios' → 'mobile'
 *     This value is injected by the Tauri WebView at startup — no async required.
 *  3. Mobile user-agent (/iPhone|iPad|iPod|Android/i) → 'mobile'
 *  4. window.innerWidth < 1024 → 'mobile'  (matches lg: breakpoint)
 *  5. Otherwise → 'desktop'
 *
 * Note: `ViewportClass` intentionally has no 'tablet' variant — tablets with
 * narrow viewports (< 1024 px) render the mobile tree; wider tablets use
 * the desktop tree. T3.5-2 may refine this if a dedicated tablet layout is needed.
 *
 * Subscribes to 'resize' and 'orientationchange' to react to viewport changes.
 * Memoises the initial value with the lazy-initialiser pattern to avoid a
 * render-then-flash on first paint.
 *
 * Story T3.5-1 — Viewport routing at App.tsx root.
 */

// Tauri v2 injects this global at runtime on all platforms
interface TauriInternals {
  platform?: string
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals
  }
}

function detectFromWindowSync(): ViewportClass {
  if (typeof window === 'undefined') return 'desktop'
  // Tauri runtime platform check (android/ios WebView)
  const tauriPlatform = window.__TAURI_INTERNALS__?.platform
  if (tauriPlatform === 'android' || tauriPlatform === 'ios') return 'mobile'
  // User-agent check (covers Android WebView on Tauri)
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return 'mobile'
  // Pixel-width check
  if (window.innerWidth < 1024) return 'mobile'
  return 'desktop'
}

export function useViewportClass(): ViewportClass {
  const [viewport, setViewport] = useState<ViewportClass>(() => detectFromWindowSync())

  // Resize / orientation listener
  useEffect(() => {
    const update = (): void => {
      const next = detectFromWindowSync()
      setViewport(next)
    }

    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return viewport
}
