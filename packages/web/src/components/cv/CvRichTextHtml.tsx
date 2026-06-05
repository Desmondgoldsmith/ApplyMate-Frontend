'use client';

import { toPreviewRichTextHtml } from '@/lib/cvRichTextPreview';
import { cn } from '@/lib/utils';

type CvRichTextHtmlProps = {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  as?: 'span' | 'div';
};

/** Renders stored CV rich-text (links, bold, italic) in preview and international templates. */
export function CvRichTextHtml({ text, className, style, as: Tag = 'span' }: CvRichTextHtmlProps) {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return null;
  return (
    <Tag
      className={cn('[&_a]:text-[#1D4ED8] [&_a]:underline', className)}
      style={style}
      dangerouslySetInnerHTML={{ __html: toPreviewRichTextHtml(trimmed) }}
    />
  );
}
