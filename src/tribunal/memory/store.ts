import { randomUUID } from 'node:crypto';

import { getDb } from '../../db/connection.js';

export type MemoryType = 'code' | 'decision' | 'domain';

export interface MemoryEntry {
  agent_group_id: string;
  type: MemoryType;
  content: string;
  /** JSON blob for extra info: file_path, tribunal_session_id, etc. */
  metadata: string;
  created_at: string;
}

export interface MemorySearchResult extends MemoryEntry {
  rank: number;
}

/** Insert a new memory entry into tribunal_memory FTS5 table. */
export function insertMemory(entry: Omit<MemoryEntry, 'created_at'>): void {
  const row: MemoryEntry = { ...entry, created_at: new Date().toISOString() };
  getDb()
    .prepare(
      `INSERT INTO tribunal_memory (agent_group_id, type, content, metadata, created_at)
       VALUES (@agent_group_id, @type, @content, @metadata, @created_at)`,
    )
    .run(row);
}

/**
 * Full-text search over tribunal_memory for a given agent group.
 * Returns up to `topK` results ranked by BM25.
 */
export function searchMemory(agentGroupId: string, query: string, topK = 5): MemorySearchResult[] {
  if (!query.trim()) return [];

  // Sanitize query for FTS5: strip special chars that break the parser
  const safeQuery = query.replace(/["*^()[\]{}|&~]/g, ' ').trim();
  if (!safeQuery) return [];

  return getDb()
    .prepare(
      `SELECT agent_group_id, type, content, metadata, created_at,
              rank
       FROM tribunal_memory
       WHERE tribunal_memory MATCH ? AND agent_group_id = ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(safeQuery, agentGroupId, topK) as MemorySearchResult[];
}

/** Retrieve recent entries of a specific type without FTS (for context injection). */
export function getRecentMemory(agentGroupId: string, type: MemoryType, limit = 10): MemoryEntry[] {
  return getDb()
    .prepare(
      `SELECT agent_group_id, type, content, metadata, created_at
       FROM tribunal_memory
       WHERE agent_group_id = ? AND type = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(agentGroupId, type, limit) as MemoryEntry[];
}

/**
 * Build a context block for injection into an Owner-Agent prompt.
 * Searches memory with the task description and formats results as markdown.
 */
export function buildMemoryContext(agentGroupId: string, task: string): string {
  const results = searchMemory(agentGroupId, task, 5);
  if (results.length === 0) return '';

  const lines: string[] = ['## 관련 과거 결정 및 코드 (RAG Memory)', ''];
  for (const r of results) {
    const meta = (() => {
      try {
        return JSON.parse(r.metadata) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
    const label =
      r.type === 'code' ? `코드 (${meta.file_path ?? '?'})` : r.type === 'decision' ? '결정' : '도메인 지식';
    lines.push(`### ${label}`);
    lines.push(r.content);
    lines.push('');
  }
  return lines.join('\n');
}

/** Manual add for /memory add <content> admin command. */
export function addDomainMemory(agentGroupId: string, content: string): void {
  insertMemory({
    agent_group_id: agentGroupId,
    type: 'domain',
    content,
    metadata: JSON.stringify({ id: randomUUID() }),
  });
}
