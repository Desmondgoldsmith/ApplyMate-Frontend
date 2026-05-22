import { describe, expect, it } from 'vitest';

import { normalizeText, toInputString } from './normalizeText';

describe('normalizeText', () => {
  it('returns strings as-is', () => {
    expect(normalizeText('hello')).toBe('hello');
  });

  it('returns empty string for nullish', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });

  it('reads .text and .content from objects', () => {
    expect(normalizeText({ text: 'from text' })).toBe('from text');
    expect(normalizeText({ content: 'from content' })).toBe('from content');
  });

  it('returns empty string for plain objects (never [object Object])', () => {
    expect(normalizeText({ foo: 1 })).toBe('');
    expect(normalizeText({ text: 42 })).toBe('');
  });

  it('stringifies finite numbers and booleans', () => {
    expect(normalizeText(42)).toBe('42');
    expect(normalizeText(true)).toBe('true');
  });
});

describe('toInputString', () => {
  it('matches normalizeText for input binding', () => {
    expect(toInputString({ text: 'x' })).toBe('x');
  });
});
