import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../shared/types/router'

// Create typed tRPC React hooks
export const trpc = createTRPCReact<AppRouter>()

// In Tauri context: no IPC link available. Queries stay in loading state.
// Real IPC via rspc is wired in T1.3.
export const trpcClient = trpc.createClient({ links: [] })
