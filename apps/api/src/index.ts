import 'dotenv/config';

import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { createContext } from './context/context';
import { appRouter } from './router';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*', // tighten before launch
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  }),
);

app.get('/', (c) =>
  c.json({ name: 'gloe-api', status: 'ok', time: new Date().toISOString() }),
);

app.get('/health', (c) => c.json({ ok: true }));

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, c) =>
      createContext({ c }) as unknown as Promise<Record<string, unknown>>,
  }),
);

const port = Number(process.env.PORT) || 4000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`▲ Gloe API listening on http://localhost:${info.port}`);
});
