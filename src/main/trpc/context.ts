import { db } from '../db';
import type { CreateContextOptions } from 'trpc-electron/main';

export interface Context {
  db: typeof db;
}

export const createContext = async (_opts: CreateContextOptions): Promise<Context> => ({
  db,
});
