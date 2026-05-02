import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

export const migration014: Migration = {
  version: 14,
  name: 'tribunal-sessions',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tribunal_sessions (
        id TEXT PRIMARY KEY,
        agent_group_id TEXT NOT NULL,
        messaging_group_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        task TEXT NOT NULL,
        current_role TEXT NOT NULL DEFAULT 'owner',
        round_count INTEGER NOT NULL DEFAULT 0,
        last_reviewer_keywords TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        owner_session_id TEXT,
        reviewer_session_id TEXT,
        arbiter_session_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tribunal_sessions_status
        ON tribunal_sessions(status);

      CREATE INDEX IF NOT EXISTS idx_tribunal_sessions_thread
        ON tribunal_sessions(messaging_group_id, thread_id);

      CREATE TABLE IF NOT EXISTS tribunal_scheduler_runs (
        agent_group_id TEXT NOT NULL,
        cron_expr TEXT NOT NULL,
        last_run TEXT NOT NULL,
        PRIMARY KEY (agent_group_id, cron_expr)
      );
    `);
  },
};
