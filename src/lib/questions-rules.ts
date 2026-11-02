/** Anonymous Q&A rules (shared client/server). */
export const QUESTION_MAX = 300;
export const ANSWER_MAX = 1000;
/** Per visitor IP: at most 5 questions per hour. */
export const QUESTION_RATE = { limit: 5, windowSec: 3600 } as const;

export function normalizeText(raw: string, max: number): string | null {
  const s = raw.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/\s+\n/g, "\n").trim();
  return s.length === 0 || s.length > max ? null : s;
}
