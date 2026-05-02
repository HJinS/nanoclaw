import { describe, expect, it } from 'vitest';

import { checkLoopGuard } from './loop-guard.js';

describe('checkLoopGuard', () => {
  it('continues when round count is below max', () => {
    const result = checkLoopGuard(
      { roundCount: 1, lastReviewerKeywords: [] },
      'REVIEWER_ISSUES\nfix the null check\nKEYWORDS: null, check',
    );
    expect(result.action).toBe('continue');
  });

  it('escalates when round count reaches 3', () => {
    const result = checkLoopGuard(
      { roundCount: 3, lastReviewerKeywords: [] },
      'REVIEWER_ISSUES\nstill broken\nKEYWORDS: broken',
    );
    expect(result.action).toBe('escalate');
    if (result.action === 'escalate') expect(result.reason).toBe('max-retries');
  });

  it('escalates on repeated keyword after round 2', () => {
    const result = checkLoopGuard(
      { roundCount: 2, lastReviewerKeywords: ['null', 'check', 'undefined'] },
      'REVIEWER_ISSUES\nstill has null check issue\nKEYWORDS: null, check, pointer',
    );
    expect(result.action).toBe('escalate');
    if (result.action === 'escalate') expect(result.reason).toBe('repeated-issue');
  });

  it('does not escalate on repeated keyword at round 1', () => {
    const result = checkLoopGuard(
      { roundCount: 1, lastReviewerKeywords: ['null', 'check'] },
      'REVIEWER_ISSUES\nnull check issue\nKEYWORDS: null, check',
    );
    expect(result.action).toBe('continue');
  });

  it('extracts updated keywords from reviewer message', () => {
    const result = checkLoopGuard(
      { roundCount: 0, lastReviewerKeywords: [] },
      'REVIEWER_ISSUES\nfix auth\nKEYWORDS: auth, token, expiry',
    );
    expect(result.action).toBe('continue');
    if (result.action === 'continue') {
      expect(result.updatedKeywords).toContain('auth');
      expect(result.updatedKeywords).toContain('token');
    }
  });
});
