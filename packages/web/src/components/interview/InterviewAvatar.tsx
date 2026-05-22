'use client';

import { motion } from 'framer-motion';

import type { InterviewPersonality } from '@/lib/api';
import {
  type AvatarPersonalityId,
  personalityConfigForAvatar,
} from '@/lib/interviewPersonalities';
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_STYLES: Record<AvatarSize, { wrap: string }> = {
  sm: { wrap: 'h-16 w-16' },
  md: { wrap: 'h-28 w-28' },
  lg: { wrap: 'h-40 w-40' },
};

export type AvatarDemeanor = 'supportive' | 'neutral' | 'strict';

export function InterviewAvatar({
  personality,
  isSpeaking,
  isListening,
  size = 'md',
  demeanor = 'neutral',
}: {
  personality: InterviewPersonality | AvatarPersonalityId;
  isSpeaking: boolean;
  isListening: boolean;
  size?: AvatarSize;
  /** Phase 4 — shifts ring intensity from simulation performance. */
  demeanor?: AvatarDemeanor;
}) {
  const avatarId = personality as AvatarPersonalityId;
  const cfg = personalityConfigForAvatar(avatarId);
  const styles = SIZE_STYLES[size];
  const clipId = `avatar-clip-${avatarId}`;

  const mouthMotion =
    isSpeaking && !isListening
      ? { d: ['M38 66 Q50 72 62 66', 'M38 66 Q50 76 62 66', 'M38 66 Q50 71 62 66'] }
      : { d: 'M38 66 Q50 72 62 66' };

  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', styles.wrap)}>
      {isSpeaking && !isListening
        ? [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-white/40"
              initial={{ opacity: 0.45, scale: 1 }}
              animate={{ opacity: [0.45, 0.15, 0], scale: [1, 1.2 + i * 0.05, 1.35 + i * 0.08] }}
              transition={{ duration: 1.7, repeat: Infinity, delay: i * 0.22, ease: 'easeOut' }}
            />
          ))
        : null}
      {isListening ? <span className="absolute inset-[-4px] rounded-full border-2 border-[#00C9B1]/85" /> : null}
      {demeanor === 'strict' && !isListening ? (
        <span className="absolute inset-[-3px] rounded-full border border-amber-400/50 ip-avatar-demeanor-strict" />
      ) : null}
      {demeanor === 'supportive' && !isListening ? (
        <span className="absolute inset-[-3px] rounded-full border border-[#00C9B1]/45 ip-avatar-demeanor-supportive" />
      ) : null}

      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br shadow-[0_10px_30px_rgba(0,0,0,0.35)]',
          cfg.avatarBg,
        )}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
          <defs>
            <clipPath id={clipId}>
              <circle cx="50" cy="50" r="50" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x="0" y="0" width="100" height="100" fill="transparent" />
            {avatarId === 'alex' ? (
              <>
                <path d="M14 95 Q50 70 86 95 Z" fill="#2F5A52" />
                <ellipse cx="50" cy="50" rx="24" ry="28" fill="#8B5E3C" />
                <path d="M25 41 Q50 16 75 41 L75 30 Q50 8 25 30 Z" fill="#1A1411" />
                <ellipse cx="40" cy="49" rx="2.4" ry="2.8" fill="#1f1712" />
                <ellipse cx="60" cy="49" rx="2.4" ry="2.8" fill="#1f1712" />
                <path d="M36 44 Q40 41 44 44" stroke="#251a14" strokeWidth="1.7" fill="none" strokeLinecap="round" />
                <path d="M56 44 Q60 41 64 44" stroke="#251a14" strokeWidth="1.7" fill="none" strokeLinecap="round" />
                <path d="M50 52 Q48 57 50 59" stroke="#70482f" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </>
            ) : null}
            {avatarId === 'sarah' ? (
              <>
                <path d="M16 95 Q50 68 84 95 Z" fill="#334C71" />
                <ellipse cx="50" cy="50" rx="24" ry="28" fill="#C68642" />
                <path d="M26 34 Q50 12 74 34 Q72 54 66 42 Q50 24 34 42 Q28 54 26 34 Z" fill="#2F211E" />
                <ellipse cx="41" cy="49" rx="2.2" ry="2.6" fill="#2d201c" />
                <ellipse cx="59" cy="49" rx="2.2" ry="2.6" fill="#2d201c" />
                <path d="M37 44 Q41 41 45 44" stroke="#3b2924" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M55 44 Q59 41 63 44" stroke="#3b2924" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M50 53 Q48 58 50 60" stroke="#9d6733" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </>
            ) : null}
            {avatarId === 'marcus' ? (
              <>
                <path d="M12 95 Q50 72 88 95 Z" fill="#60433A" />
                <ellipse cx="50" cy="50" rx="24" ry="28" fill="#6B3A2A" />
                <ellipse cx="50" cy="25" rx="22" ry="10" fill="#402820" opacity="0.35" />
                <ellipse cx="40" cy="49" rx="2.4" ry="2.8" fill="#20130f" />
                <ellipse cx="60" cy="49" rx="2.4" ry="2.8" fill="#20130f" />
                <path d="M36 43 Q40 41 44 43" stroke="#2a1a14" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M56 43 Q60 41 64 43" stroke="#2a1a14" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M50 53 Q49 58 50 60" stroke="#553025" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </>
            ) : null}
            {avatarId === 'zoe' ? (
              <>
                <path d="M14 95 Q50 68 86 95 Z" fill="#5A3F73" />
                <ellipse cx="50" cy="50" rx="24" ry="28" fill="#D4956A" />
                <path
                  d="M20 36 Q27 16 40 18 Q45 10 53 14 Q62 8 69 16 Q80 18 82 35 Q76 33 74 40 Q67 31 58 34 Q49 26 40 33 Q29 30 26 40 Q24 34 20 36 Z"
                  fill="#3C2A31"
                />
                <ellipse cx="40" cy="49" rx="2.2" ry="2.6" fill="#2b1f24" />
                <ellipse cx="60" cy="49" rx="2.2" ry="2.6" fill="#2b1f24" />
                <path d="M36 44 Q40 41 44 44" stroke="#4b3139" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M56 44 Q60 41 64 44" stroke="#4b3139" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M50 53 Q48 58 50 60" stroke="#b57b56" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </>
            ) : null}
            {avatarId === 'jordan' ? (
              <>
                <path d="M14 95 Q50 70 86 95 Z" fill="#3D4450" />
                <ellipse cx="50" cy="50" rx="24" ry="28" fill="#9A8B7A" />
                <path d="M28 38 Q50 20 72 38 L70 32 Q50 14 30 32 Z" fill="#2A2E35" />
                <rect x="32" y="46" width="36" height="8" rx="3" fill="#1E2228" opacity="0.85" />
                <ellipse cx="40" cy="49" rx="2" ry="2.4" fill="#1a1816" />
                <ellipse cx="60" cy="49" rx="2" ry="2.4" fill="#1a1816" />
                <path d="M50 58 Q48 61 50 62" stroke="#6d5f52" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </>
            ) : null}
            <motion.path
              d="M38 66 Q50 72 62 66"
              animate={mouthMotion}
              transition={{ duration: 0.36, repeat: isSpeaking && !isListening ? Infinity : 0 }}
              stroke="#211916"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
