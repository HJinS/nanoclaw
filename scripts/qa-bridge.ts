import Fastify from 'fastify';
import type { RunRequest, RunResponse, BaselineSaveRequest } from './qa-bridge-types.js';

const PORT = 17290;
const server = Fastify({ logger: true });

server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

server.post<{ Body: RunRequest; Reply: RunResponse }>('/run', async (request, reply) => {
  // implemented in Task 6
  reply.code(501);
  return { runId: request.body.runId, results: [], regressionDiffs: [], error: 'not implemented' };
});

server.post<{ Body: BaselineSaveRequest }>('/baseline', async (request, reply) => {
  // implemented in Task 6
  reply.code(501);
  return { error: 'not implemented' };
});

server.get<{ Params: { bundleId: string; flowName: string } }>(
  '/baseline/:bundleId/:flowName',
  async (request, reply) => {
    // implemented in Task 6
    reply.code(501);
    return { error: 'not implemented' };
  },
);

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '127.0.0.1' });
    console.error(`[qa-bridge] listening on http://127.0.0.1:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
