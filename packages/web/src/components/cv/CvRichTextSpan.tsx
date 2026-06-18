'use client';

import { toPreviewRichTextHtml } from '@/lib/cvRichTextPreview';
import { cn } from '@/lib/utils';

/** Render stored CV field HTML (preserves `u.cv-change-marker` tailor highlights). */
export function CvRichTextSpan({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const trimmed = html?.trim() ?? '';
  if (!trimmed) return null;
  return (
    <span
      className={cn('[&_a]:text-[#1D4ED8] [&_a]:underline', className)}
      dangerouslySetInnerHTML={{ __html: toPreviewRichTextHtml(trimmed) }}
    />
  );
}
