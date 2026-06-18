'use client';

import type { JobDescriptionHighlights } from '@/lib/api';
import {
  descriptionSectionsFromHighlights,
  hasStructuredDescriptionSections,
  splitTextWithHighlights,
} from '@/lib/jobDescriptionHighlights';
import { cn } from '@/lib/utils';

type Props = {
  description: string;
  highlights?: JobDescriptionHighlights | null;
  className?: string;
};

function HighlightedText({
  text,
  highlights,
  className,
}: {
  text: string;
  highlights?: JobDescriptionHighlights | null;
  className?: string;
}) {
  const terms = highlights?.terms ?? [];
  const parts = splitTextWithHighlights(text, terms);

  if (parts.length === 0) {
    return null;
  }

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlight ? (
          <span
            key={`hl-${index}`}
            className="border-b border-[#00C9B1]/70 text-white/90 decoration-clone"
          >
            {part.text}
          </span>
        ) : (
          <span key={`txt-${index}`}>{part.text}</span>
        ),
      )}
    </span>
  );
}

export function JobDescriptionHighlightsPanel({
  description,
  highlights,
  className,
}: Props) {
  const sections = descriptionSectionsFromHighlights(highlights);
  const plain = description.trim();

  if (hasStructuredDescriptionSections(highlights)) {
    return (
      <div className={cn('space-y-6', className)}>
        {sections.map((section, sectionIndex) => (
          <section
            key={`${section.id || section.title || 'section'}-${sectionIndex}`}
            className="border-t border-white/[0.08] pt-5 first:border-t-0 first:pt-0"
          >
            {section.title?.trim() ? (
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
            ) : null}
            {section.format === 'bullets' ? (
              <ul
                className={cn(
                  'mt-3 list-disc space-y-2 pl-5 text-sm leading-[1.65] text-white/80',
                  !section.title?.trim() && 'mt-0',
                )}
              >
                {(section.items ?? [])
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .map((item) => (
                    <li key={item.slice(0, 80)}>
                      <HighlightedText text={item} highlights={highlights} />
                    </li>
                  ))}
              </ul>
            ) : (
              <p
                className={cn(
                  'mt-3 text-sm leading-[1.65] text-white/80',
                  !section.title?.trim() && 'mt-0',
                )}
              >
                <HighlightedText text={section.body ?? ''} highlights={highlights} />
              </p>
            )}
          </section>
        ))}
      </div>
    );
  }

  if (!plain) {
    return <p className={cn('text-sm text-white/45', className)}>No description on file.</p>;
  }

  return (
    <div className={cn('text-sm leading-[1.65] text-white/80', className)}>
      {plain.split(/\n{2,}/).map((paragraph) => (
        <p key={paragraph.slice(0, 60)} className="mt-4 first:mt-0">
          <HighlightedText text={paragraph.replace(/\n/g, ' ').trim()} highlights={highlights} />
        </p>
      ))}
    </div>
  );
}
