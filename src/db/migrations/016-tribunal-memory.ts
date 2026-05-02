import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

export const migration016: Migration = {
  version: 16,
  name: 'tribunal-memory',
  up(db: Database.Database) {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS tribunal_memory USING fts5(
        agent_group_id UNINDEXED,
        type UNINDEXED,
        content,
        metadata UNINDEXED,
        created_at UNINDEXED,
        tokenize = "unicode61"
      );
    `);
  },
};
