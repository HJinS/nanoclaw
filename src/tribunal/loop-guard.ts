export interface LoopGuardState {
  roundCount: number;
  lastReviewerKeywords: string[];
}

export type LoopGuardDecision =
  | { action: 'continue'; updatedKeywords: string[] }
  | { action: 'escalate'; reason: 'max-retries' | 'repeated-issue'; summary: string };

const MAX_ROUNDS = 3;

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'been', 'they',
  'your', 'what', 'issue', 'fix', 'the', 'and',
]);

export function checkLoopGuard(state: LoopGuardState, reviewerMessage: string): LoopGuardDecision {
  if (state.roundCount >= MAX_ROUNDS) {
    return {
      action: 'escalate',
      reason: 'max-retries',
      summary: `${MAX_ROUNDS}라운드 후 자동 해결 불가. 사람의 판단이 필요합니다.`,
    };
  }

  const keywords = extractKeywords(reviewerMessage);

  if (state.roundCount >= 2) {
    const repeated = keywords.filter((k) => state.lastReviewerKeywords.includes(k));
    if (repeated.length > 0) {
      return {
        action: 'escalate',
        reason: 'repeated-issue',
        summary: `Reviewer가 동일 이슈(${repeated.join(', ')})를 2회 연속 지적. Arbiter 개입.`,
      };
    }
  }

  return { action: 'continue', updatedKeywords: keywords };
}

function extractKeywords(message: string): string[] {
  const keywordsLine = message
    .split('\n')
    .find((l) => l.trim().toUpperCase().startsWith('KEYWORDS:'));
  if (keywordsLine) {
    return keywordsLine
      .replace(/^KEYWORDS:/i, '')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  }
  return message
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 10);
}
