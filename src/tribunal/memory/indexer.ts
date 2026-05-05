import { getDb } from '../../db/connection.js';
import { log } from '../../log.js';
import { insertMemory } from './store.js';

interface TribunalSessionRow {
  id: string;
  agent_group_id: string;
  task: string;
  status: 'completed' | 'escalated';
  round_count: number;
  updated_at: string;
}

/**
 * Called after Arbiter approves or escalates a Tribunal session.
 * Indexes the final task description + outcome as a 'decision' memory.
 * Caller is responsible for providing the approved code snippet separately
 * via indexApprovedCode().
 */
export function indexTribunalDecision(tribunalSessionId: string, arbiterMessage: string): void {
  const session = getDb().prepare('SELECT * FROM tribunal_sessions WHERE id = ?').get(tribunalSessionId) as
    | TribunalSessionRow
    | undefined;

  if (!session) return;

  const outcome = session.status === 'completed' ? 'Arbiter 승인' : 'Arbiter 에스컬레이션';
  const content = [
    `작업: ${session.task}`,
    `결과: ${outcome} (${session.round_count}라운드)`,
    `Arbiter 메시지: ${arbiterMessage.slice(0, 500)}`,
  ].join('\n');

  insertMemory({
    agent_group_id: session.agent_group_id,
    type: 'decision',
    content,
    metadata: JSON.stringify({
      tribunal_session_id: tribunalSessionId,
      status: session.status,
      round_count: session.round_count,
      indexed_at: new Date().toISOString(),
    }),
  });

  log.info('Tribunal memory: indexed decision', { tribunalSessionId, status: session.status });
}

/**
 * Index a code snippet approved by the Arbiter.
 * Call this from the delivery hook when ARBITER_APPROVED is detected,
 * passing the code extracted from the Owner's last message.
 */
export function indexApprovedCode(
  agentGroupId: string,
  tribunalSessionId: string,
  code: string,
  filePath: string,
): void {
  if (!code.trim()) return;

  insertMemory({
    agent_group_id: agentGroupId,
    type: 'code',
    content: code,
    metadata: JSON.stringify({
      tribunal_session_id: tribunalSessionId,
      file_path: filePath,
      indexed_at: new Date().toISOString(),
    }),
  });

  log.info('Tribunal memory: indexed approved code', { agentGroupId, filePath });
}
