import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAgentGroup } from '../db/agent-groups.js';
import { closeDb, initTestDb } from '../db/connection.js';
import { runMigrations } from '../db/migrations/index.js';
import {
  advanceTribunalSession,
  createTribunalSession,
  getTribunalSession,
  getTribunalSessionByThread,
} from './orchestrator.js';

function now() {
  return new Date().toISOString();
}

beforeEach(() => {
  const db = initTestDb();
  runMigrations(db);
  createAgentGroup({
    id: 'ag-owner',
    name: 'Owner',
    folder: 'tribunal-owner',
    agent_provider: null,
    created_at: now(),
  });
  createAgentGroup({
    id: 'ag-reviewer',
    name: 'Reviewer',
    folder: 'tribunal-reviewer',
    agent_provider: null,
    created_at: now(),
  });
  createAgentGroup({
    id: 'ag-arbiter',
    name: 'Arbiter',
    folder: 'tribunal-arbiter',
    agent_provider: null,
    created_at: now(),
  });
});

afterEach(() => {
  closeDb();
});

describe('createTribunalSession', () => {
  it('creates a session with owner role', () => {
    const session = createTribunalSession({
      agentGroupId: 'ag-owner',
      messagingGroupId: 'mg-1',
      threadId: 'thread-1',
      task: '로그인 API 구현',
    });
    expect(session.current_role).toBe('owner');
    expect(session.round_count).toBe(0);
    expect(session.status).toBe('active');
  });
});

describe('getTribunalSessionByThread', () => {
  it('finds active session by thread', () => {
    createTribunalSession({
      agentGroupId: 'ag-owner',
      messagingGroupId: 'mg-1',
      threadId: 'thread-42',
      task: '작업',
    });
    const found = getTribunalSessionByThread('mg-1', 'thread-42');
    expect(found).not.toBeNull();
    expect(found?.thread_id).toBe('thread-42');
  });
});

describe('advanceTribunalSession', () => {
  it('owner done → moves to reviewer', () => {
    const s = createTribunalSession({
      agentGroupId: 'ag-owner',
      messagingGroupId: 'mg-1',
      threadId: 't1',
      task: 'task',
    });
    const next = advanceTribunalSession(s.id, 'OWNER_DONE\nFiles changed: src/login.ts');
    expect(next?.current_role).toBe('reviewer');
  });

  it('reviewer approved → moves to arbiter', () => {
    const s = createTribunalSession({
      agentGroupId: 'ag-owner',
      messagingGroupId: 'mg-1',
      threadId: 't2',
      task: 'task',
    });
    advanceTribunalSession(s.id, 'OWNER_DONE\nFiles changed: x');
    const next = advanceTribunalSession(s.id, 'REVIEWER_APPROVED');
    expect(next?.current_role).toBe('arbiter');
  });

  it('reviewer issues → increments round, returns to owner', () => {
    const s = createTribunalSession({
      agentGroupId: 'ag-owner',
      messagingGroupId: 'mg-1',
      threadId: 't3',
      task: 'task',
    });
    advanceTribunalSession(s.id, 'OWNER_DONE\nFiles changed: x');
    const next = advanceTribunalSession(s.id, 'REVIEWER_ISSUES\nfix null\nKEYWORDS: null');
    expect(next?.current_role).toBe('owner');
    expect(next?.round_count).toBe(1);
  });

  it('arbiter approved → marks completed', () => {
    const s = createTribunalSession({
      agentGroupId: 'ag-owner',
      messagingGroupId: 'mg-1',
      threadId: 't4',
      task: 'task',
    });
    advanceTribunalSession(s.id, 'OWNER_DONE\nFiles changed: x');
    advanceTribunalSession(s.id, 'REVIEWER_APPROVED');
    const next = advanceTribunalSession(s.id, 'ARBITER_APPROVED\nLooks good');
    expect(next?.status).toBe('completed');
  });

  it('returns null for non-existent session', () => {
    const result = advanceTribunalSession('no-such-id', 'OWNER_DONE');
    expect(result).toBeNull();
  });

  it('getTribunalSession returns null for missing id', () => {
    expect(getTribunalSession('missing')).toBeNull();
  });
});
