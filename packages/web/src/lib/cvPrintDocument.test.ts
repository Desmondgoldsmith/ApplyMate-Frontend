import { describe, expect, it } from 'vitest';
import { testableSelector } from './cvPrintDocument';

describe('testableSelector', () => {
  it('drops pseudo-classes and pseudo-elements', () => {
    expect(testableSelector('a:hover')).toBe('a');
    expect(testableSelector('li::marker')).toBe('li');
    expect(testableSelector('.list > li:not(.x):first-child')).toBe(
      '.list > li',
    );
  });

  it('keeps escaped colons inside Tailwind variant class names', () => {
    expect(testableSelector('.empty\\:hidden:empty')).toBe('.empty\\:hidden');
    expect(testableSelector('.sm\\:flex-row')).toBe('.sm\\:flex-row');
    expect(testableSelector('.hover\\:underline:hover')).toBe(
      '.hover\\:underline',
    );
  });
});
