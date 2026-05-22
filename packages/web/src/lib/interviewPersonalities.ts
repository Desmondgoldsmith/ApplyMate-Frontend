import type { InterviewPersonality } from '@/lib/api';

export type AvatarPersonalityId = InterviewPersonality | 'jordan';

const PERSONALITY_KEYS = new Set<AvatarPersonalityId>(['alex', 'sarah', 'marcus', 'zoe', 'jordan']);

/** Maps API values (any casing) to a valid personality id; defaults to alex. */
export function normalizeInterviewPersonalityId(raw: unknown): InterviewPersonality {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (PERSONALITY_KEYS.has(s as InterviewPersonality)) return s as InterviewPersonality;
  return 'alex';
}

export interface PersonalityConfig {
  id: InterviewPersonality;
  name: string;
  role: string;
  description: string;
  style: string;
  color: string;
  accentColor: string;
  avatarBg: string;
  voiceName: string;
  voiceRate: number;
  voicePitch: number;
  greetingMessage: string;
  /** Spoken after the final answer is submitted; thanks the candidate and sets expectations for scoring time. */
  postInterviewThankYou: string;
  transitionPhrases: string[];
  encouragementPhrases: string[];
}

export const PERSONALITIES: Record<InterviewPersonality, PersonalityConfig> = {
  alex: {
    id: 'alex',
    name: 'Desmond Goldsmith',
    role: 'Senior Recruiter',
    description: 'Warm and encouraging. Great for building confidence.',
    style: 'Supportive & Conversational',
    color: 'bg-emerald-500/10',
    accentColor: 'text-emerald-400',
    avatarBg: 'from-emerald-400 to-teal-500',
    voiceName: 'Google UK English Male',
    voiceRate: 0.95,
    voicePitch: 1.05,
    greetingMessage:
      "Hi! I'm Desmond Goldsmith, and I'm really looking forward to learning more about you today. There are no trick questions here — just a conversation. Ready to get started?",
    postInterviewThankYou:
      "Thank you so much for your time today — you did really well. Your personalised feedback is usually ready in about thirty seconds to a minute and a half. You can stay on this screen, or check back anytime from your interview history.",
    transitionPhrases: [
      "That's really helpful, thank you.",
      'I appreciate you sharing that.',
      "Great, let's keep going.",
      'Thank you for that answer.',
    ],
    encouragementPhrases: ["You're doing great.", 'That was a strong answer.', 'I like how you framed that.'],
  },
  sarah: {
    id: 'sarah',
    name: 'Amara Osei',
    role: 'Hiring Manager',
    description: 'Professional and structured. Ideal for corporate roles.',
    style: 'Formal & STAR-focused',
    color: 'bg-blue-500/10',
    accentColor: 'text-blue-400',
    avatarBg: 'from-blue-400 to-indigo-500',
    voiceName: 'Google UK English Female',
    voiceRate: 1.0,
    voicePitch: 1.0,
    greetingMessage:
      "Good day. I'm Amara Osei, and I'll be conducting your interview today. We'll work through several structured questions. Please use specific examples where possible. Shall we begin?",
    postInterviewThankYou:
      "Thank you for completing the interview. Your scored results and feedback are typically available within about thirty seconds to a minute and a half. You may remain here while they load, or return later via interview history.",
    transitionPhrases: ['Understood. Moving on.', 'Thank you. Next question.', "Noted. Let's continue.", 'Alright, next.'],
    encouragementPhrases: ['That was well-structured.', 'Good use of a specific example.', 'Clear and concise.'],
  },
  marcus: {
    id: 'marcus',
    name: 'Isaac Kumi',
    role: 'Engineering Director',
    description: 'Direct and challenging. Prepares you for tough interviews.',
    style: 'Direct & Challenging',
    color: 'bg-orange-500/10',
    accentColor: 'text-orange-400',
    avatarBg: 'from-orange-400 to-red-500',
    voiceName: 'Google US English',
    voiceRate: 1.05,
    voicePitch: 0.9,
    greetingMessage:
      "I'm Isaac Kumi. I'll be direct with you — I ask tough questions because that's what the real interview will be like. The goal is to prepare you properly. Ready?",
    postInterviewThankYou:
      "Thanks — we're done. Your results are usually back in about thirty seconds to a minute and a half. Hang tight here, or grab them later from interview history.",
    transitionPhrases: ['Okay. Next question.', 'Alright. Moving forward.', "Fine. Let's continue.", 'Next.'],
    encouragementPhrases: [
      "That's the right approach.",
      "Good — that's what I wanted to hear.",
      'Solid answer.',
    ],
  },
  zoe: {
    id: 'zoe',
    name: 'Priya Sharma',
    role: 'Technical Lead',
    description: 'Casual and culture-focused. Perfect for startup roles.',
    style: 'Casual & Creative',
    color: 'bg-purple-500/10',
    accentColor: 'text-purple-400',
    avatarBg: 'from-purple-400 to-pink-500',
    voiceName: 'Google US English Female',
    voiceRate: 1.1,
    voicePitch: 1.1,
    greetingMessage:
      "Hi — I'm Priya Sharma. Walk me through your reasoning step by step on each question. I care about how you think, not just the final answer. Ready?",
    postInterviewThankYou:
      "Hey, thank you — that was great. Your results should land in roughly thirty seconds to a minute and a half. You can chill here while they load, or pop back in from interview history whenever works for you.",
    transitionPhrases: ['Love it! Next one.', 'Cool, okay next.', 'Awesome. So...', 'Got it! Moving on.'],
    encouragementPhrases: ["Oh that's a great example!", 'I love how you handled that.', 'Yes! Exactly.'],
  },
};

/** UI-only observer avatar — not sent to interview create API */
export const JORDAN_PERSONALITY: PersonalityConfig = {
  id: 'alex',
  name: 'Jordan Blake',
  role: 'Interview Observer',
  description: 'Minimal prompts — feedback after the session.',
  style: 'Observing',
  color: 'bg-slate-500/10',
  accentColor: 'text-slate-300',
  avatarBg: 'from-slate-500 to-zinc-700',
  voiceName: 'Google UK English Male',
  voiceRate: 0.9,
  voicePitch: 1,
  greetingMessage:
    "I'm Jordan Blake. I'll stay quiet during the session — you'll get full feedback when we're done.",
  postInterviewThankYou:
    'Thank you. Your full feedback will be ready shortly — check back in about a minute.',
  transitionPhrases: ['Next question.', 'Continue.', 'Alright.', 'Moving on.'],
  encouragementPhrases: [],
};

export function personalityConfigForAvatar(id: AvatarPersonalityId): PersonalityConfig {
  if (id === 'jordan') return JORDAN_PERSONALITY;
  return PERSONALITIES[id];
}
