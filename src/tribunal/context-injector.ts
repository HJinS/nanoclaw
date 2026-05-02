import { log } from '../log.js';
import { buildMemoryContext } from './memory/store.js';

export interface ContextInjectionConfig {
  agentGroupId: string;
  task: string;
  openApiUrl?: string;
  openApiFilePath?: string;
}

interface OpenApiEndpoint {
  method: string;
  path: string;
  summary?: string;
  requestBody?: string;
  responseSchema?: string;
}

/**
 * Build the full context prefix for an Owner-Agent turn.
 * Includes RAG memory results + OpenAPI spec summary if configured.
 * Figma context is injected via MCP server at the container level,
 * not here — this module handles host-side injection only.
 */
export async function buildInjectedContext(config: ContextInjectionConfig): Promise<string> {
  const sections: string[] = [];

  const memoryCtx = buildMemoryContext(config.agentGroupId, config.task);
  if (memoryCtx) sections.push(memoryCtx);

  const openApiCtx = await fetchOpenApiContext(config.openApiUrl, config.openApiFilePath);
  if (openApiCtx) sections.push(openApiCtx);

  return sections.join('\n\n');
}

async function fetchOpenApiContext(url?: string, filePath?: string): Promise<string> {
  if (!url && !filePath) return '';

  let spec: unknown = null;

  if (url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) spec = await res.json();
    } catch (err) {
      log.warn('Context injector: failed to fetch OpenAPI spec from URL', { url, err });
    }
  }

  if (!spec && filePath) {
    try {
      const fs = await import('node:fs');
      const raw = fs.readFileSync(filePath, 'utf-8');
      spec = filePath.endsWith('.json') ? JSON.parse(raw) : parseYamlSpec(raw);
    } catch (err) {
      log.warn('Context injector: failed to read OpenAPI spec from file', { filePath, err });
    }
  }

  if (!spec) return '';

  try {
    return formatOpenApiSpec(spec);
  } catch (err) {
    log.warn('Context injector: failed to format OpenAPI spec', { err });
    return '';
  }
}

function parseYamlSpec(raw: string): unknown {
  // Minimal YAML parse: only needed for top-level paths/info sections.
  // Full YAML parser would require a dep; use js-yaml if available, else skip.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml') as { load: (s: string) => unknown };
    return yaml.load(raw);
  } catch {
    // js-yaml not installed — return null so file fallback is skipped
    return null;
  }
}

function formatOpenApiSpec(spec: unknown): string {
  const s = spec as Record<string, unknown>;
  const info = s.info as Record<string, string> | undefined;
  const paths = s.paths as Record<string, Record<string, unknown>> | undefined;

  if (!paths) return '';

  const endpoints: OpenApiEndpoint[] = [];

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const operation = op as Record<string, unknown>;
      const summary = (operation.summary ?? operation.operationId ?? '') as string;

      let requestBody = '';
      const rb = operation.requestBody as Record<string, unknown> | undefined;
      if (rb) {
        const content = rb.content as Record<string, unknown> | undefined;
        const jsonSchema = content?.['application/json'] as Record<string, unknown> | undefined;
        if (jsonSchema?.schema) {
          requestBody = JSON.stringify(jsonSchema.schema).slice(0, 300);
        }
      }

      let responseSchema = '';
      const responses = operation.responses as Record<string, unknown> | undefined;
      const ok = responses?.['200'] as Record<string, unknown> | undefined;
      const okContent = ok?.content as Record<string, unknown> | undefined;
      const okJson = okContent?.['application/json'] as Record<string, unknown> | undefined;
      if (okJson?.schema) {
        responseSchema = JSON.stringify(okJson.schema).slice(0, 300);
      }

      endpoints.push({ method: method.toUpperCase(), path, summary, requestBody, responseSchema });
    }
  }

  if (endpoints.length === 0) return '';

  const lines: string[] = [
    `## Spring OpenAPI 스펙${info?.title ? ` — ${info.title}` : ''}`,
    '',
  ];
  for (const ep of endpoints.slice(0, 30)) {
    lines.push(`- **${ep.method} ${ep.path}**${ep.summary ? ` — ${ep.summary}` : ''}`);
    if (ep.requestBody) lines.push(`  - Request: \`${ep.requestBody}\``);
    if (ep.responseSchema) lines.push(`  - Response: \`${ep.responseSchema}\``);
  }
  if (endpoints.length > 30) lines.push(`  _(외 ${endpoints.length - 30}개 엔드포인트)_`);

  return lines.join('\n');
}
