import { describe, expect, it } from 'vitest';

import {
  INTERVIEW_PERSONAS,
  isLegacyRoleInterviewerLabel,
  resolveInterviewerPersonName,
  resolveSessionPersona,
} from '@/lib/interviewPersonas';

describe('isLegacyRoleInterviewerLabel', () => {
  it('detects role titles', () => {
    expect(isLegacyRoleInterviewerLabel('Friendly Coach')).toBe(true);
    expect(isLegacyRoleInterviewerLabel('Desmond Goldsmith')).toBe(false);
  });
});

describe('resolveInterviewerPersonName', () => {
  it('uses API human name when provided', () => {
    const base = INTERVIEW_PERSONAS.friendly_coach;
    expect(resolveInterviewerPersonName('Desmond Goldsmith', base)).toBe('Desmond Goldsmith');
  });

  it('falls back for legacy role title in interviewerLabel', () => {
    const base = INTERVIEW_PERSONAS.friendly_coach;
    expect(resolveInterviewerPersonName('Friendly Coach', base)).toBe('Desmond Goldsmith');
  });
});

describe('resolveSessionPersona', () => {
  it('maps interviewerRoleLabel from API', () => {
    const p = resolveSessionPersona({
      interviewPersona: 'strict_interviewer',
      interviewerLabel: 'Isaac Kumi',
      interviewerRoleLabel: 'Strict Interviewer',
      personality: 'marcus',
    });
    expect(p.personName).toBe('Isaac Kumi');
    expect(p.roleLabel).toBe('Strict Interviewer');
  });

  it('uses personName not role when only legacy interviewerLabel is sent', () => {
    const p = resolveSessionPersona({
      interviewPersona: 'friendly_coach',
      interviewerLabel: 'Friendly Coach',
      personality: 'alex',
    });
    expect(p.personName).toBe('Desmond Goldsmith');
    expect(p.roleLabel).toBe('Friendly Coach');
  });
});
