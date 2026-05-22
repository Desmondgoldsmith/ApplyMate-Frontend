/** Shared rich-text → safe HTML for CV preview (parity with InlineField). */

import { toDisplayRichHtml } from '@/lib/cvRichTextCore';

/**
 * Render stored CV field HTML / markdown-lite for preview.
 * Preserves `<a href="https://…">` links created in the builder toolbar.
 */
export function toPreviewRichTextHtml(input: string): string {
  return toDisplayRichHtml(input);
}
