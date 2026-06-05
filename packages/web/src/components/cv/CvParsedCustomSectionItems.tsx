'use client';

import type { CSSProperties, MouseEvent } from 'react';

import { useCVEdit } from '@/components/cv/CVEditContext';
import { EntryToolbar } from '@/components/cv/EntryToolbar';
import { InlineField } from '@/components/cv/InlineField';
import {
  parsedCustomBulletPlaceholder,
  parsedCustomDatePlaceholder,
  parsedCustomMainPlaceholder,
} from '@/lib/cvParsedCustomSectionUtils';
import { newLocalId, type CVBuilderParsedCustomSection } from '@/lib/cvBuilder';
import { splitCvStoredRange } from '@/lib/cvDate';
import { cn } from '@/lib/utils';

function entryFocusStyle(focused: boolean): CSSProperties {
  return {
    outline: focused ? '1.5px dashed #00C9B1' : 'none',
    outlineOffset: '3px',
    borderRadius: '3px',
    position: 'relative',
  };
}

function cvBulletFieldDomIsEmpty(e: { currentTarget: HTMLElement }): boolean {
  const t = (e.currentTarget.innerText || '').replace(/\u200b/g, '').replace(/\u00a0/g, ' ').trim();
  return t.length === 0;
}

type CvParsedCustomSectionItemsProps = {
  block: CVBuilderParsedCustomSection;
  previewSectionId: string;
  className?: string;
  textClassName?: string;
  entryFieldOn?: (entryKey: string, field: string) => boolean;
  setEntryFieldOn?: (entryKey: string, field: string, enabled: boolean) => void;
};

export function CvParsedCustomSectionItems({
  block,
  previewSectionId,
  className,
  textClassName = 'text-[9pt] text-black',
  entryFieldOn: entryFieldOnProp,
  setEntryFieldOn: setEntryFieldOnProp,
}: CvParsedCustomSectionItemsProps) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing && ctx?.onUpdate);
  const fieldOn = (entryKey: string, field: string) => entryFieldOnProp?.(entryKey, field) ?? true;
  const usesRangeDates = /volunteer|experience|employment|work|project/i.test(block.sectionType);
  const mainPh = parsedCustomMainPlaceholder(block.sectionType);
  const datePh = parsedCustomDatePlaceholder(block.sectionType, usesRangeDates);
  const bulletPh = parsedCustomBulletPlaceholder(block.sectionType);

  const patchBlock = (mapper: (b: CVBuilderParsedCustomSection) => CVBuilderParsedCustomSection) => {
    if (!ctx?.onUpdate) return;
    ctx.onUpdate({
      parsedCustomSections: ctx.data.parsedCustomSections.map((b) =>
        b.sectionId === block.sectionId ? mapper(b) : b,
      ),
    });
  };

  if (!inline || !ctx) {
    return (
      <div className={cn('space-y-1.5', className)}>
        {block.items
          .filter((i) => i.text.trim() || i.subItems.length || i.date?.trim())
          .map((item) => (
            <p key={item.id} className={textClassName}>
              <span className="font-bold">{item.text.trim() || '—'}</span>
              {item.date?.trim() ? <span> · {item.date.trim()}</span> : null}
            </p>
          ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {block.items.length === 0 ? (
        <button
          type="button"
          className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
          onClick={() =>
            patchBlock((b) => ({
              ...b,
              items: [{ id: newLocalId(), text: '', date: '', subItems: [] }],
            }))
          }
        >
          + Click to add {block.title.trim().toLowerCase() || 'item'}
        </button>
      ) : null}
      {block.items.map((item, itemIdx) => {
        const focused = ctx.focusedEntryId === item.id;
        const entryKey = `parsed:${item.id}`;
        const onEntryClick = (e: MouseEvent) => {
          e.stopPropagation();
          ctx.setFocusedSection(previewSectionId);
          ctx.setFocusedEntryId(item.id);
          ctx.setFocusedEntrySection(previewSectionId);
        };
        return (
          <div
            key={item.id}
            data-entry-id={item.id}
            style={entryFocusStyle(Boolean(focused))}
            onClick={onEntryClick}
          >
            {focused ? (
              <EntryToolbar
                sectionType={block.sectionType}
                anchorSectionId={previewSectionId}
                onAddBullet={() =>
                  patchBlock((b) => ({
                    ...b,
                    items: b.items.map((it) =>
                      it.id === item.id
                        ? { ...it, subItems: [...(it.subItems.length ? it.subItems : ['']), ''] }
                        : it,
                    ),
                  }))
                }
                onAddEntry={() =>
                  patchBlock((b) => ({
                    ...b,
                    items: [...b.items, { id: newLocalId(), text: '', date: '', subItems: [] }],
                  }))
                }
                onMoveUp={() => {
                  if (itemIdx === 0) return;
                  patchBlock((b) => {
                    const next = [...b.items];
                    [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                    return { ...b, items: next };
                  });
                }}
                onMoveDown={() => {
                  if (itemIdx >= block.items.length - 1) return;
                  patchBlock((b) => {
                    const next = [...b.items];
                    [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                    return { ...b, items: next };
                  });
                }}
                onDelete={() => {
                  patchBlock((b) => ({ ...b, items: b.items.filter((it) => it.id !== item.id) }));
                  ctx.setFocusedEntryId(null);
                  ctx.setFocusedEntrySection(null);
                }}
                onDatePick={(startDate, endDate) =>
                  patchBlock((b) => ({
                    ...b,
                    items: b.items.map((it) => {
                      if (it.id !== item.id) return it;
                      return {
                        ...it,
                        date: usesRangeDates
                          ? [startDate, endDate].filter(Boolean).join(' - ')
                          : startDate,
                      };
                    }),
                  }))
                }
                dateMode={usesRangeDates ? 'range' : 'single'}
                dateStart={splitCvStoredRange(item.date ?? '').start}
                dateEnd={splitCvStoredRange(item.date ?? '').end}
                showMoveUp={itemIdx > 0}
                showMoveDown={itemIdx < block.items.length - 1}
                showAddBullet
                showDatePicker
                settingsOptions={
                  setEntryFieldOnProp
                    ? [
                        {
                          key: 'date',
                          label: 'Date',
                          enabled: fieldOn(entryKey, 'date'),
                          onToggle: (next) => setEntryFieldOnProp(entryKey, 'date', next),
                        },
                        {
                          key: 'bullets',
                          label: 'Bullets',
                          enabled: fieldOn(entryKey, 'bullets'),
                          onToggle: (next) => setEntryFieldOnProp(entryKey, 'bullets', next),
                        },
                      ]
                    : []
                }
              />
            ) : null}
            <p className={cn('font-bold', textClassName)}>
              <InlineField
                value={item.text}
                placeholder={mainPh}
                sectionId={previewSectionId}
                entryId={item.id}
                onChange={(v) =>
                  patchBlock((b) => ({
                    ...b,
                    items: b.items.map((it) => (it.id === item.id ? { ...it, text: v } : it)),
                  }))
                }
                className={cn('font-bold', textClassName)}
              />
              {fieldOn(entryKey, 'date') ? (
                <>
                  <span className="font-normal"> </span>
                  <InlineField
                    value={item.date ?? ''}
                    placeholder={datePh}
                    sectionId={previewSectionId}
                    entryId={item.id}
                    onChange={(v) =>
                      patchBlock((b) => ({
                        ...b,
                        items: b.items.map((it) => (it.id === item.id ? { ...it, date: v } : it)),
                      }))
                    }
                    className={textClassName}
                  />
                </>
              ) : null}
            </p>
            {fieldOn(entryKey, 'bullets') ? (
              <ul className={cn('mt-1 list-none space-y-0.5 pl-0 leading-[1.35]', textClassName)}>
                {(item.subItems.length > 0 ? item.subItems : ['']).map((line, lineIdx) => (
                  <li key={`${item.id}-sub-${lineIdx}`} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">•</span>
                    <span className="flex-1">
                      <InlineField
                        value={line}
                        placeholder={bulletPh}
                        sectionId={previewSectionId}
                        entryId={item.id}
                        layout="block"
                        onChange={(v) =>
                          patchBlock((b) => ({
                            ...b,
                            items: b.items.map((it) => {
                              if (it.id !== item.id) return it;
                              const subs = [...(it.subItems.length ? it.subItems : [''])];
                              subs[lineIdx] = v;
                              return { ...it, subItems: subs };
                            }),
                          }))
                        }
                        onInputKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            patchBlock((b) => ({
                              ...b,
                              items: b.items.map((it) => {
                                if (it.id !== item.id) return it;
                                const next = [...(it.subItems.length ? it.subItems : [''])];
                                next.splice(lineIdx + 1, 0, '');
                                return { ...it, subItems: next };
                              }),
                            }));
                          }
                          if (
                            e.key === 'Backspace' &&
                            cvBulletFieldDomIsEmpty(e) &&
                            (item.subItems.length || 1) > 1
                          ) {
                            e.preventDefault();
                            patchBlock((b) => ({
                              ...b,
                              items: b.items.map((it) =>
                                it.id === item.id
                                  ? {
                                      ...it,
                                      subItems: (it.subItems.length ? it.subItems : ['']).filter(
                                        (_, i) => i !== lineIdx,
                                      ),
                                    }
                                  : it,
                              ),
                            }));
                          }
                        }}
                        className={textClassName}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
