import { describe, expect, it } from 'vitest';

import { richTextPlainText } from './cvRichTextCore';
import { toPreviewRichTextHtml } from './cvRichTextPreview';

describe('toPreviewRichTextHtml', () => {
  it('renders anchor tags from stored HTML', () => {
    const html = toPreviewRichTextHtml(
      '<a href="https://github.com/user/repo">Portfolio</a>',
    );
    expect(html).toContain('<a href="https://github.com/user/repo"');
    expect(html).toContain('Portfolio</a>');
  });

  it('extracts visible text from anchor HTML for emptiness checks', () => {
    expect(richTextPlainText('<a href="https://github.com/user/repo">Portfolio</a>')).toBe(
      'Portfolio',
    );
    expect(richTextPlainText('<a href="https://example.com"></a>')).toBe('');
  });

  it('renders anchor hrefs that contain ampersands in query strings', () => {
    const html = toPreviewRichTextHtml(
      '<a href="https://example.com/path?foo=1&bar=2">Docs</a>',
    );
    expect(html).toContain('href="https://example.com/path?foo=1&amp;bar=2"');
    expect(html).toContain('Docs</a>');
  });
});
