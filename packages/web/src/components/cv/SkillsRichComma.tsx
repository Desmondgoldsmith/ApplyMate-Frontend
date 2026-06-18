'use client';

import { CvRichTextSpan } from '@/components/cv/CvRichTextSpan';
import { richTextPlainText } from '@/lib/cvRichTextCore';

/** Comma-separated skills with tailor underline markers preserved. */
export function SkillsRichComma({ skills }: { skills: string[] }) {
  const items = skills.filter((s) => richTextPlainText(s).length > 0);
  if (items.length === 0) return null;
  return (
    <span>
      {items.map((skill, index) => (
        <span key={`${skill}-${index}`}>
          {index > 0 ? ', ' : null}
          <CvRichTextSpan html={skill} />
        </span>
      ))}
    </span>
  );
}
