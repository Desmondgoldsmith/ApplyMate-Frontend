'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';

import { useCVEdit } from '@/components/cv/CVEditContext';
import { EntryToolbar } from '@/components/cv/EntryToolbar';
import { InlineField } from '@/components/cv/InlineField';
import {
  cvReferenceHasContent,
  filterCvBuilderReferences,
  newLocalId,
  type CVBuilderData,
  type CVBuilderReference,
} from '@/lib/cvBuilder';
import { cn } from '@/lib/utils';

export type CvReferencesLayout = 'onyx-grid' | 'compact' | 'inline-separated';

function entryFocusStyle(focused: boolean): CSSProperties {
  return {
    outline: focused ? '1.5px dashed #00C9B1' : 'none',
    outlineOffset: '3px',
    borderRadius: '3px',
    position: 'relative',
  };
}

type CvEditableReferencesListProps = {
  references: CVBuilderReference[];
  layout: CvReferencesLayout;
  className?: string;
  textClassName?: string;
  emptyClassName?: string;
};

export function CvEditableReferencesList({
  references,
  layout,
  className,
  textClassName = 'text-[9pt] text-black',
  emptyClassName = 'text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline',
}: CvEditableReferencesListProps) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing && ctx?.onUpdate);
  const cleaned = filterCvBuilderReferences(references);
  const rows = inline
    ? cleaned
    : cleaned.filter((r) => cvReferenceHasContent(r));

  const editableRows = () => filterCvBuilderReferences(references);

  const patchRefs = (next: CVBuilderReference[]) => {
    ctx?.onUpdate({ references: next });
  };

  const updateRow = (id: string, patch: Partial<CVBuilderReference>) => {
    patchRefs(editableRows().map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const mapRef = (r: CVBuilderReference, rIdx: number) => {
    const focused = ctx?.focusedEntryId === r.id;
    const rows = editableRows();
    const toolbar =
      inline && focused ? (
        <EntryToolbar
          sectionType="references"
          onAddEntry={() =>
            patchRefs([
              ...rows,
              { id: newLocalId(), name: '', title: '', company: '', email: '', phone: '' },
            ])
          }
          onMoveUp={() => {
            if (rIdx === 0) return;
            const next = [...rows];
            [next[rIdx - 1], next[rIdx]] = [next[rIdx], next[rIdx - 1]];
            patchRefs(next);
          }}
          onMoveDown={() => {
            if (rIdx >= rows.length - 1) return;
            const next = [...rows];
            [next[rIdx], next[rIdx + 1]] = [next[rIdx + 1], next[rIdx]];
            patchRefs(next);
          }}
          onDelete={() => {
            patchRefs(rows.filter((row) => row.id !== r.id));
            ctx?.setFocusedEntryId(null);
            ctx?.setFocusedEntrySection(null);
          }}
          showMoveUp={rIdx > 0}
          showMoveDown={rIdx < rows.length - 1}
          showDatePicker={false}
        />
      ) : null;

    const onEntryClick = (e: MouseEvent) => {
      e.stopPropagation();
      ctx?.setFocusedSection('references');
      ctx?.setFocusedEntryId(r.id);
      ctx?.setFocusedEntrySection('references');
    };

    if (layout === 'onyx-grid') {
      return (
        <div
          key={r.id}
          data-entry-id={r.id}
          style={entryFocusStyle(Boolean(focused))}
          onClick={onEntryClick}
        >
          {toolbar}
          <p className="font-bold">
            {inline && ctx ? (
              <InlineField
                value={r.name}
                placeholder="Name"
                sectionId="references"
                entryId={r.id}
                onChange={(v) => updateRow(r.id, { name: v })}
                className="font-bold text-[#333]"
              />
            ) : (
              r.name.trim() || 'Reference'
            )}
          </p>
          <p className="text-[#333]/85">
            {inline && ctx ? (
              <>
                <InlineField
                  value={r.title}
                  placeholder="Title"
                  sectionId="references"
                  entryId={r.id}
                  onChange={(v) => updateRow(r.id, { title: v })}
                  className="text-[#333]"
                />
                <span> · </span>
                <InlineField
                  value={r.company}
                  placeholder="Company"
                  sectionId="references"
                  entryId={r.id}
                  onChange={(v) => updateRow(r.id, { company: v })}
                  className="text-[#333]"
                />
              </>
            ) : (
              [r.title.trim(), r.company.trim()].filter(Boolean).join(' · ') || 'Title · Company'
            )}
          </p>
          <p>
            <span className="font-bold">Phone:</span>{' '}
            {inline && ctx ? (
              <InlineField
                value={r.phone}
                placeholder="Phone"
                sectionId="references"
                entryId={r.id}
                onChange={(v) => updateRow(r.id, { phone: v })}
                className="text-[#333]"
              />
            ) : (
              r.phone.trim() || '—'
            )}
          </p>
          <p>
            <span className="font-bold">Email:</span>{' '}
            {inline && ctx ? (
              <InlineField
                value={r.email}
                placeholder="Email"
                sectionId="references"
                entryId={r.id}
                onChange={(v) => updateRow(r.id, { email: v })}
                className="text-[#333]"
              />
            ) : (
              r.email.trim() || '—'
            )}
          </p>
        </div>
      );
    }

    if (layout === 'inline-separated') {
      return (
        <div
          key={r.id}
          data-entry-id={r.id}
          style={entryFocusStyle(Boolean(focused))}
          onClick={onEntryClick}
        >
          {toolbar}
          <p>
            <span className="font-semibold">
              {inline && ctx ? (
                <InlineField
                  value={r.name}
                  placeholder="Reference name"
                  sectionId="references"
                  entryId={r.id}
                  onChange={(v) => updateRow(r.id, { name: v })}
                  className={cn('font-semibold', textClassName)}
                />
              ) : (
                r.name.trim() || 'Reference'
              )}
            </span>
            {inline && ctx ? (
              <>
                <span className="text-black/35"> · </span>
                <InlineField
                  value={r.title}
                  placeholder="Title"
                  sectionId="references"
                  entryId={r.id}
                  onChange={(v) => updateRow(r.id, { title: v })}
                  className={textClassName}
                />
                <span className="text-black/35"> · </span>
                <InlineField
                  value={r.company}
                  placeholder="Company"
                  sectionId="references"
                  entryId={r.id}
                  onChange={(v) => updateRow(r.id, { company: v })}
                  className={textClassName}
                />
                <span className="text-black/35"> · </span>
                <InlineField
                  value={r.email}
                  placeholder="Email"
                  sectionId="references"
                  entryId={r.id}
                  onChange={(v) => updateRow(r.id, { email: v })}
                  className={textClassName}
                />
                <span className="text-black/35"> · </span>
                <InlineField
                  value={r.phone}
                  placeholder="Phone"
                  sectionId="references"
                  entryId={r.id}
                  onChange={(v) => updateRow(r.id, { phone: v })}
                  className={textClassName}
                />
              </>
            ) : (
              <>
                {r.title.trim() ? <span> · {r.title.trim()}</span> : null}
                {r.company.trim() ? <span> · {r.company.trim()}</span> : null}
                {r.email.trim() ? <span> · {r.email.trim()}</span> : null}
                {r.phone.trim() ? <span> · {r.phone.trim()}</span> : null}
              </>
            )}
          </p>
        </div>
      );
    }

    return (
      <div
        key={r.id}
        data-entry-id={r.id}
        style={entryFocusStyle(Boolean(focused))}
        onClick={onEntryClick}
      >
        {toolbar}
        <p className={textClassName}>
          {inline && ctx ? (
            <InlineField
              value={r.name}
              placeholder="Reference name"
              sectionId="references"
              entryId={r.id}
              onChange={(v) => updateRow(r.id, { name: v })}
              className={cn('font-bold', textClassName)}
            />
          ) : (
            <span className="font-bold">{r.name.trim() || 'Reference'}</span>
          )}
          {inline && ctx ? (
            <>
              {' · '}
              <InlineField
                value={r.title}
                placeholder="Title"
                sectionId="references"
                entryId={r.id}
                onChange={(v) => updateRow(r.id, { title: v })}
                className={textClassName}
              />
              {' · '}
              <InlineField
                value={r.company}
                placeholder="Company"
                sectionId="references"
                entryId={r.id}
                onChange={(v) => updateRow(r.id, { company: v })}
                className={textClassName}
              />
              {' · '}
              <InlineField
                value={r.email}
                placeholder="Email"
                sectionId="references"
                entryId={r.id}
                onChange={(v) => updateRow(r.id, { email: v })}
                className={textClassName}
              />
              {' · '}
              <InlineField
                value={r.phone}
                placeholder="Phone"
                sectionId="references"
                entryId={r.id}
                onChange={(v) => updateRow(r.id, { phone: v })}
                className={textClassName}
              />
            </>
          ) : (
            <>
              {r.title.trim() ? <span> · {r.title.trim()}</span> : null}
              {r.company.trim() ? <span> · {r.company.trim()}</span> : null}
              {r.email.trim() ? <span> · {r.email.trim()}</span> : null}
              {r.phone.trim() ? <span> · {r.phone.trim()}</span> : null}
            </>
          )}
        </p>
      </div>
    );
  };

  const addEmpty = () =>
    patchRefs([
      ...filterCvBuilderReferences(references),
      { id: newLocalId(), name: '', title: '', company: '', email: '', phone: '' },
    ]);

  const emptyButton = inline ? (
    <button
      type="button"
      className={cn(emptyClassName, layout === 'onyx-grid' && 'col-span-2')}
      onClick={addEmpty}
    >
      + Click to add reference
    </button>
  ) : null;

  const body: ReactNode =
    rows.length > 0 ? (
      rows.map((r, rIdx) => mapRef(r, rIdx))
    ) : (
      emptyButton
    );

  if (layout === 'onyx-grid') {
    return (
      <div className={cn('grid grid-cols-2 gap-x-4 gap-y-3', className)} style={{ color: '#333333' }}>
        {body}
      </div>
    );
  }

  return <div className={cn('mt-1.5 space-y-1.5', textClassName, className)}>{body}</div>;
}
