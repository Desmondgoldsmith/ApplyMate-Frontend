import { describe, expect, it } from 'vitest';

import { parseYouTubeVideoId, walkthroughEmbedUrl } from './walkthroughVideo';

describe('parseYouTubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reads %s', (input, id) => {
    expect(parseYouTubeVideoId(input)).toBe(id);
  });

  it.each([
    '',
    'not a url',
    'https://vimeo.com/123',
    'https://youtube.com/watch?v=short',
  ])('rejects %p', (input) => {
    expect(parseYouTubeVideoId(input)).toBeNull();
  });

  it('builds a privacy-enhanced embed URL', () => {
    expect(walkthroughEmbedUrl('dQw4w9WgXcQ')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
    );
  });
});
