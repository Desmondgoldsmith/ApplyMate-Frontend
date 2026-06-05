/**
 * User-facing labels for AI usage / analytics flows (backend AiUsageEvent).
 * Keep in sync with server enum; unknown values fall back to the raw code.
 */
export const AI_USAGE_FLOW_LABELS: Record<string, string> = {
  CV_CHAT: 'CV builder chat',
  CV_PARSE: 'CV file or text extraction',
  CV_SPELLCHECK: 'Spell and grammar check',
  CV_IMPROVE_REWRITE: 'Bullet or summary rewrite',
  CV_OPTIMIZE: 'CV optimize',
  CV_IMPROVEMENT_APPLY: 'Apply with AI',
  CV_ASSISTANT: 'CV assistant command',
  CV_ASSISTANT_GLOBAL: 'Global CV assistant command',
  CV_TAILOR: 'Job tailoring',
  CV_CHAT_STRUCTURED_EXTRACT: 'Chat — structured CV from pasted text',
};

export function labelForAiUsageFlow(flow: string | null | undefined): string {
  const key = (flow ?? '').trim();
  if (!key) return 'AI action';
  return AI_USAGE_FLOW_LABELS[key] ?? key.replace(/_/g, ' ');
}
