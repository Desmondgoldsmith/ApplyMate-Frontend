'use client';

import { GitMerge, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  useMergeCvProfilesCreate,
  useMergeCvProfilesPreview,
} from '@/hooks/useMergeCvProfiles';
import type { CvProfileSummary } from '@/lib/api';
import { readCvDataSummaryText } from '@/lib/cvAssistantDiffDisplay';
import {
  CV_MERGE_MAX_PROFILES,
  type CvMergePreviewResult,
} from '@/lib/cvProfileMerge';
import { itemCountLabel } from '@/lib/cvParseImportSummary';
import { getApiErrorMessage } from '@/lib/axios';
import {
  cvEditorPath,
  prefetchCvProfileForEditor,
} from '@/lib/cvProfileNavigation';
import { cn } from '@/lib/utils';

export type MergeCvProfilesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileIds: string[];
  profiles: CvProfileSummary[];
  onMerged?: (profileId: string) => void;
};

function sourceNames(
  profileIds: string[],
  profiles: CvProfileSummary[],
): string[] {
  const byId = new Map(profiles.map((p) => [p.id, p.name] as const));
  return profileIds.map((id) => byId.get(id)?.trim() || 'Untitled CV');
}

export function MergeCvProfilesModal({
  open,
  onOpenChange,
  profileIds,
  profiles,
  onMerged,
}: MergeCvProfilesModalProps) {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const previewMutation = useMergeCvProfilesPreview();
  const createMutation = useMergeCvProfilesCreate();

  const [instructions, setInstructions] = useState('');
  const [preview, setPreview] = useState<CvMergePreviewResult | null>(null);
  const [mergeName, setMergeName] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const sortedIds = useMemo(
    () => [...new Set(profileIds.map((id) => id.trim()).filter(Boolean))],
    [profileIds],
  );

  const names = useMemo(
    () => sourceNames(sortedIds, profiles),
    [sortedIds, profiles],
  );

  const resetState = useCallback(() => {
    setInstructions('');
    setPreview(null);
    setMergeName('');
    setPreviewError(null);
    previewMutation.reset();
    createMutation.reset();
  }, [createMutation, previewMutation]);

  const runPreview = useCallback(async () => {
    if (sortedIds.length < 2) return;
    setPreviewError(null);
    try {
      const result = await previewMutation.mutateAsync({
        profileIds: sortedIds,
        instructions: instructions.trim() || undefined,
      });
      setPreview(result);
      setMergeName(result.suggestedName.trim() || 'Merged CV');
    } catch (e) {
      const msg = getApiErrorMessage(e) || 'Could not generate merge preview';
      setPreviewError(msg);
      toast.error(msg);
    }
  }, [instructions, previewMutation, sortedIds, toast]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    if (sortedIds.length >= 2 && sortedIds.length <= CV_MERGE_MAX_PROFILES) {
      void runPreview();
    }
  }, [open, sortedIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps -- preview once per open + selection

  const summaryPreview = preview
    ? readCvDataSummaryText(preview.structured).trim()
    : '';

  const busy = previewMutation.isPending || createMutation.isPending;

  const handleSave = async () => {
    if (!preview || !mergeName.trim()) return;
    try {
      const created = await createMutation.mutateAsync({
        profileIds: sortedIds,
        name: mergeName.trim(),
        structured: preview.structured,
        instructions: preview.instructions || instructions.trim() || undefined,
        template: profiles.find((p) => p.id === sortedIds[0])?.template,
      });
      const newId = created.profileId.trim();
      if (!newId) throw new Error('Missing merged profile id');
      await prefetchCvProfileForEditor(queryClient, newId);
      toast.success('Merged CV saved');
      onOpenChange(false);
      if (onMerged) {
        onMerged(newId);
      } else {
        router.push(cvEditorPath(newId));
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not save merged CV');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
      title="Merge CVs"
      description="Creates a new CV — your originals stay unchanged."
    >
      <div className="mt-3 space-y-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Merging {sortedIds.length} profiles
          </p>
          <ul className="mt-2 space-y-1">
            {names.map((name, i) => (
              <li key={sortedIds[i] ?? i} className="text-sm text-white/75">
                • {name}
              </li>
            ))}
          </ul>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-white/55">
            Merge instructions (optional)
          </span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value.slice(0, 2000))}
            disabled={busy}
            rows={3}
            placeholder="e.g. Emphasise full-stack; dedupe the Acme role."
            className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.1] bg-[#0C0F0F] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#00C9B1]/45"
          />
        </label>

        {!preview && previewMutation.isPending ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin text-[#00C9B1]" />
            Generating merge preview…
          </div>
        ) : null}

        {previewError && !preview ? (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-100/90">
            {previewError}
            <Button
              type="button"
              variant="ghost"
              className="mt-3 h-8 border border-white/10 text-xs"
              disabled={previewMutation.isPending}
              onClick={() => void runPreview()}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {preview ? (
          <GlowCard
            className="border border-[#00C9B1]/20"
            contentClassName="p-4 sm:p-5"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#00C9B1]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Merge preview</p>
                {summaryPreview ? (
                  <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-white/55">
                    {summaryPreview}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-white/40">
                    Combined content across {preview.sections.length} section
                    {preview.sections.length === 1 ? '' : 's'}.
                  </p>
                )}
              </div>
            </div>

            {preview.sections.length > 0 ? (
              <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto" aria-label="Merged sections">
                {preview.sections.map((row) => (
                  <li
                    key={`${row.type}-${row.label}-${row.order}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#080b0b]/60 px-3 py-2"
                  >
                    <p className="truncate text-sm font-medium text-white/85">
                      {row.label}
                    </p>
                    <span className="shrink-0 text-xs text-white/40">
                      {itemCountLabel(row.itemCount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <label className="mt-4 block border-t border-white/[0.08] pt-4">
              <span className="text-xs font-semibold text-white/55">CV name</span>
              <input
                type="text"
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value.slice(0, 100))}
                disabled={busy}
                className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0C0F0F] px-3 py-2 text-sm text-white outline-none focus:border-[#00C9B1]/45"
              />
            </label>
          </GlowCard>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.08] pt-4">
          <Button
            type="button"
            variant="ghost"
            className="border border-white/10"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {preview && instructions.trim() !== preview.instructions ? (
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10"
              disabled={busy}
              onClick={() => void runPreview()}
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh preview'
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            className="gap-1.5"
            disabled={!preview || !mergeName.trim() || busy}
            onClick={() => void handleSave()}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitMerge className="h-4 w-4" />
            )}
            Save merged CV
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function useCvProfileMergeSelection(profiles: CvProfileSummary[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          return next;
        }
        if (next.size >= CV_MERGE_MAX_PROFILES) return prev;
        next.add(id);
        return next;
      });
    },
    [],
  );

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(profiles.map((p) => p.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [profiles]);

  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);
  const canMerge =
    selectedList.length >= 2 && selectedList.length <= CV_MERGE_MAX_PROFILES;
  const overLimit = selectedList.length > CV_MERGE_MAX_PROFILES;

  return { selectedIds, selectedList, toggle, clear, canMerge, overLimit };
}

export function CvProfileMergeToolbar({
  selectedCount,
  canMerge,
  overLimit,
  onMerge,
  onClear,
  busy = false,
  className,
}: {
  selectedCount: number;
  canMerge: boolean;
  overLimit: boolean;
  onMerge: () => void;
  onClear: () => void;
  busy?: boolean;
  className?: string;
}) {
  if (selectedCount === 0) return null;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/[0.06] px-3 py-2',
        className,
      )}
    >
      <p className="text-xs text-white/70">
        {selectedCount} selected
        {overLimit ? ` — select at most ${CV_MERGE_MAX_PROFILES} to merge` : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-8 border border-white/10 px-2.5 text-xs"
          disabled={busy}
          onClick={onClear}
        >
          Clear
        </Button>
        <Button
          type="button"
          className="h-8 gap-1 px-2.5 text-xs"
          disabled={!canMerge || busy}
          onClick={onMerge}
        >
          <GitMerge className="h-3.5 w-3.5" />
          Merge selected
        </Button>
      </div>
    </div>
  );
}

export function CvProfileMergeCheckbox({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className="inline-flex shrink-0 cursor-pointer items-center"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className="h-4 w-4 rounded border-white/20 bg-[#0C0F0F] text-[#00C9B1] focus:ring-[#00C9B1]/40"
      />
    </label>
  );
}
