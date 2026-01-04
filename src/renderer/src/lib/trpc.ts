import { createTRPCReact } from '@trpc/react-query';
import { ipcLink } from 'trpc-electron/renderer';
import type { AppRouter } from '../../../main/trpc';

// Create typed tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// Check if we're running inside Electron (electronTRPC is exposed by preload)
export const isElectron = typeof window !== 'undefined' && 'electronTRPC' in window;

// Create the tRPC client with IPC link (only works inside Electron)
export const trpcClient = trpc.createClient({
  links: isElectron ? [ipcLink()] : [],
});
