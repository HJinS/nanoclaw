import { randomUUID } from 'node:crypto';

import { getDb } from '../db/connection.js';
import { checkLoopGuard } from './loop-guard.js';

export interface TribunalSession {
  id: string;
  agent_group_id: string;
  messaging_group_id: string;
  thread_id: string;
  task: string;
  current_role: 'owner' | 'reviewer' | 'arbiter';
  round_count: number;
  last_reviewer_keywords: string;
  status: 'active' | 'completed' | 'escalated';
  owner_session_id: string | null;
  reviewer_session_id: string | null;
  arbiter_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export function createTribunalSession(params: {
  agentGroupId: string;
  messagingGroupId: string;
  threadId: string;
  task: string;
}): TribunalSession {
  const ts = new Date().toISOString();
  const session: TribunalSession = {
    id: randomUUID(),
    agent_group_id: params.agentGroupId,
    messaging_group_id: params.messagingGroupId,
    thread_id: params.threadId,
    task: params.task,
    current_role: 'owner',
    round_count: 0,
    last_reviewer_keywords: '[]',
    status: 'active',
    owner_session_id: null,
    reviewer_session_id: null,
    arbiter_session_id: null,
    created_at: ts,
    updated_at: ts,
  };

  getDb()
    .prepare(
      `INSERT INTO tribunal_sessions
       (id, agent_group_id, messaging_group_id, thread_id, task,
        current_role, round_count, last_reviewer_keywords, status,
        owner_session_id, reviewer_session_id, arbiter_session_id,
        created_at, updated_at)
       VALUES (@id, @agent_group_id, @messaging_group_id, @thread_id, @task,
               @current_role, @round_count, @last_reviewer_keywords, @status,
               @owner_session_id, @reviewer_session_id, @arbiter_session_id,
               @created_at, @updated_at)`,
    )
    .run(session);

  return session;
}

export function getTribunalSession(id: string): TribunalSession | null {
  return (
    (getDb().prepare('SELECT * FROM tribunal_sessions WHERE id = ?').get(id) as TribunalSession | undefined) ?? null
  );
}

export function getTribunalSessionByThread(messagingGroupId: string, threadId: string): TribunalSession | null {
  return (
    (getDb()
      .prepare("SELECT * FROM tribunal_sessions WHERE messaging_group_id = ? AND thread_id = ? AND status = 'active'")
      .get(messagingGroupId, threadId) as TribunalSession | undefined) ?? null
  );
}

export function getTribunalSessionByNanoclawSession(nanoclawSessionId: string): TribunalSession | null {
  return (
    (getDb()
      .prepare(
        `SELECT * FROM tribunal_sessions
         WHERE (owner_session_id = ? OR reviewer_session_id = ? OR arbiter_session_id = ?)
           AND status = 'active'`,
      )
      .get(nanoclawSessionId, nanoclawSessionId, nanoclawSessionId) as TribunalSession | undefined) ?? null
  );
}

export function advanceTribunalSession(tribunalSessionId: string, agentMessage: string): TribunalSession | null {
  const session = getTribunalSession(tribunalSessionId);
  if (!session || session.status !== 'active') return null;

  const ts = new Date().toISOString();

  if (session.current_role === 'owner') {
    if (agentMessage.includes('OWNER_DONE')) {
      updateSession(session.id, { current_role: 'reviewer', updated_at: ts });
    }
    return getTribunalSession(session.id);
  }

  if (session.current_role === 'reviewer') {
    const keywords = JSON.parse(session.last_reviewer_keywords) as string[];
    const guard = checkLoopGuard({ roundCount: session.round_count, lastReviewerKeywords: keywords }, agentMessage);

    if (guard.action === 'escalate') {
      updateSession(session.id, { current_role: 'arbiter', updated_at: ts });
      return getTribunalSession(session.id);
    }

    if (agentMessage.includes('REVIEWER_APPROVED')) {
      updateSession(session.id, { current_role: 'arbiter', updated_at: ts });
      return getTribunalSession(session.id);
    }

    if (agentMessage.includes('REVIEWER_ISSUES')) {
      updateSession(session.id, {
        current_role: 'owner',
        round_count: session.round_count + 1,
        last_reviewer_keywords: JSON.stringify(guard.updatedKeywords ?? []),
        updated_at: ts,
      });
      return getTribunalSession(session.id);
    }

    return session;
  }

  if (session.current_role === 'arbiter') {
    if (agentMessage.includes('ARBITER_APPROVED')) {
      updateSession(session.id, { status: 'completed', updated_at: ts });
    } else if (agentMessage.includes('ARBITER_ESCALATE')) {
      updateSession(session.id, { status: 'escalated', updated_at: ts });
    }
    return getTribunalSession(session.id);
  }

  return session;
}

function updateSession(id: string, updates: Partial<TribunalSession>): void {
  const fields = Object.keys(updates)
    .map((k) => `${k} = @${k}`)
    .join(', ');
  getDb()
    .prepare(`UPDATE tribunal_sessions SET ${fields} WHERE id = @id`)
    .run({ ...updates, id });
}
