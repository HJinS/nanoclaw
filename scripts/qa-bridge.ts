import Fastify from 'fastify';
import fs from 'node:fs';
import type { RunRequest, RunResponse, BaselineSaveRequest } from './qa-bridge-types.js';
import {
  ensureBootedDevice,
  installIpa,
  terminateApp,
  uninstallApp,
} from './qa-bridge/simulator.js';
import { runFlow } from './qa-bridge/maestro.js';
import {
  compareWithBaseline,
  saveBaseline,
  hasBaseline,
  getBaselineScreenshots,
} from './qa-bridge/regression.js';

const PORT = 17290;
const server = Fastify({ logger: true });

server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

server.post<{ Body: RunRequest; Reply: RunResponse }>('/run', async (request, reply) => {
  const { ipaPath, bundleId, flows, deviceId, runId } = request.body;

  if (!fs.existsSync(ipaPath)) {
    reply.code(400);
    return { runId, results: [], regressionDiffs: [], error: `IPA not found: ${ipaPath}` };
  }

  let udid: string;
  try {
    udid = await ensureBootedDevice(deviceId);
  } catch (err) {
    reply.code(500);
    return { runId, results: [], regressionDiffs: [], error: `Simulator error: ${String(err)}` };
  }

  try {
    await uninstallApp(udid, bundleId);
    await installIpa(udid, ipaPath);
  } catch (err) {
    reply.code(500);
    return { runId, results: [], regressionDiffs: [], error: `IPA install failed: ${String(err)}` };
  }

  const results = [];
  const allDiffs = [];

  for (const flow of flows) {
    const result = await runFlow(flow.name, flow.yaml, udid);

    if (!hasBaseline(bundleId, flow.name) && result.screenshotPaths.length > 0) {
      saveBaseline(bundleId, flow.name, result.screenshotPaths);
    } else if (result.screenshotPaths.length > 0) {
      const diffs = await compareWithBaseline(bundleId, flow.name, result.screenshotPaths);
      allDiffs.push(...diffs);
    }

    results.push({
      name: flow.name,
      passed: result.passed,
      durationMs: result.durationMs,
      screenshotPaths: result.screenshotPaths,
      error: result.error,
    });
  }

  await terminateApp(udid, bundleId);

  return { runId, results, regressionDiffs: allDiffs };
});

server.post<{ Body: BaselineSaveRequest }>('/baseline', async (request) => {
  const { bundleId, flowName, screenshotPaths } = request.body;
  saveBaseline(bundleId, flowName, screenshotPaths);
  return { saved: screenshotPaths.length };
});

server.get<{ Params: { bundleId: string; flowName: string } }>(
  '/baseline/:bundleId/:flowName',
  async (request, reply) => {
    const { bundleId, flowName } = request.params;
    const paths = getBaselineScreenshots(bundleId, flowName);
    if (paths.length === 0) {
      reply.code(404);
      return { error: 'No baseline found' };
    }
    return { screenshotPaths: paths };
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
