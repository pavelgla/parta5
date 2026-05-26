import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/server/routers';

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
    }),
  ],
});
