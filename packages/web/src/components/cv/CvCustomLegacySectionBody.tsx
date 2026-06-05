'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { Fragment } from 'react';

import { useCVEdit } from '@/components/cv/CVEditContext';
import { EntryToolbar } from '@/components/cv/EntryToolbar';
import { InlineField } from '@/components/cv/InlineField';
import { newLocalId } from '@/lib/cvBuilder';
import { cn } from '@/lib/utils';

function entryFocusStyle(focused: boolean): CSSProperties {
  return {
    outline: focused ? '1.5px dashed #00C9B1' : 'none',
    outlineOffset: '3px',
    borderRadius: '3px',
    position: 'relative',
  };
}

type CvCustomLegacySectionBodyProps = {
  textClassName?: string;
  bodyClassName?: string;
};

export function CvCustomLegacySectionBody({
  textClassName = 'text-[9pt] text-black',
  bodyClassName,
}: CvCustomLegacySectionBodyProps) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing && ctx?.onUpdate);
  if (!ctx) return null;
  const sections = ctx.data.customSections;

  const rows =
    inline
      ? sections
      : sections.filter((x) => x.title.trim() || x.body.trim());

  if (rows.length === 0 && inline) {
    return (
      <button
        type="button"
        className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
        onClick={() => ctx.onUpdate({ customSections: [{ id: newLocalId(), title: '', body: '' }] })}
      >
        + Click to add custom section
      </button>
    );
  }

  return (
    <>
      {rows.map((x, xIdx) => (
        <Fragment key={x.id}>
          {inline && ctx.focusedEntryId === x.id ? (
            <EntryToolbar
              sectionType="custom"
              onAddEntry={() =>
                ctx.onUpdate({ customSections: [...sections, { id: newLocalId(), title: '', body: '' }] })
              }
              onMoveUp={() => {
                if (xIdx === 0) return;
                const next = [...sections];
                [next[xIdx - 1], next[xIdx]] = [next[xIdx], next[xIdx - 1]];
                ctx.onUpdate({ customSections: next });
              }}
              onMoveDown={() => {
                if (xIdx >= sections.length - 1) return;
                const next = [...sections];
                [next[xIdx], next[xIdx + 1]] = [next[xIdx + 1], next[xIdx]];
                ctx.onUpdate({ customSections: next });
              }}
              onDelete={() => {
                ctx.onUpdate({ customSections: sections.filter((row) => row.id !== x.id) });
                ctx.setFocusedEntryId(null);
                ctx.setFocusedEntrySection(null);
              }}
              showMoveUp={xIdx > 0}
              showMoveDown={xIdx < sections.length - 1}
              showDatePicker={false}
            />
          ) : null}
          <div
            data-entry-id={x.id}
            style={entryFocusStyle(ctx.focusedEntryId === x.id)}
            onClick={(e) => {
              e.stopPropagation();
              ctx.setFocusedSection('custom-legacy');
              ctx.setFocusedEntryId(x.id);
              ctx.setFocusedEntrySection('custom-legacy');
            }}
          >
            {inline ? (
              <>
                <InlineField
                  value={x.title}
                  placeholder="Section heading (e.g. Volunteering, Certifications)"
                  sectionId="custom-legacy"
                  entryId={x.id}
                  onChange={(v) =>
                    ctx.onUpdate({
                      customSections: sections.map((row) => (row.id === x.id ? { ...row, title: v } : row)),
                    })
                  }
                  className={cn('mb-1 font-bold', textClassName)}
                />
                <InlineField
                  multiline
                  layout="block"
                  value={x.body}
                  placeholder="Describe this section — role, organization, dates, key outcomes, or bullet points (one per line)."
                  sectionId="custom-legacy"
                  entryId={x.id}
                  onChange={(v) =>
                    ctx.onUpdate({
                      customSections: sections.map((row) => (row.id === x.id ? { ...row, body: v } : row)),
                    })
                  }
                  className={cn('leading-relaxed', bodyClassName ?? textClassName)}
                />
              </>
            ) : (
              <>
                <p className={cn('font-bold', textClassName)}>{x.title.trim() || 'Section'}</p>
                <p className={cn('whitespace-pre-wrap leading-relaxed', bodyClassName ?? textClassName)}>
                  {x.body.trim() || '—'}
                </p>
              </>
            )}
          </div>
        </Fragment>
      ))}
    </>
  );
}
