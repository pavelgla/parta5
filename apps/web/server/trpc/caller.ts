import { createCallerFactory } from './init';
import { appRouter } from '@/server/routers';
import { createContext } from './init';

const createCaller = createCallerFactory(appRouter);

export async function serverCaller() {
  const ctx = await createContext();
  return createCaller(ctx);
}
