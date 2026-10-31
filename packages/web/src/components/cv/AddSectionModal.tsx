'use client';

import { queryKeys } from '@/lib/queryKeys';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  FolderKanban,
  HeartHandshake,
  Languages,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import type { CVSectionRecord } from '@/lib/api';
import { insertNewSectionIdProfessionally } from '@/lib/cvSectionProfessionalOrder';
import { useToast } from '@/components/ui/Toast';
import { getApiErrorMessage } from '@/lib/axios';
import { savePendingCvEdits } from '@/lib/cvPendingEdits';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

const OPTIONAL: { type: string; label: string }[] = [
  { type: 'projects', label: 'Projects' },
  { type: 'certifications', label: 'Certifications' },
  { type: 'languages', label: 'Languages' },
  { type: 'achievements', label: 'Achievements / Awards' },
  { type: 'references', label: 'References' },
  { type: 'volunteering', label: 'Volunteering' },
  { type: 'interests', label: 'Interests' },
  { type: 'publications', label: 'Publications' },
  { type: 'custom', label: 'Custom section' },
];

async function reorderNewSectionProfessionally(
  profileId: string,
  newSectionId: string,
): Promise<void> {
  const id = newSectionId?.trim();
  if (!id) return;
  const rows = await api.cv.getSections(true, profileId);
  if (!rows.some((r) => r.id === id)) return;
  const sortedByServer = [...rows]
    .sort((a, b) => a.order - b.order)
    .map((r) => r.id);
  const proposed = insertNewSectionIdProfessionally(rows, id);
  if (proposed.join('|') === sortedByServer.join('|')) return;
  await api.cv.reorderSections(proposed, profileId);
}

const LABEL_BY_TYPE = Object.fromEntries(
  OPTIONAL.map(({ type, label }) => [type, label]),
);
const OPTIONAL_ICON_BY_TYPE: Record<string, LucideIcon> = {
  projects: FolderKanban,
  certifications: Award,
  languages: Languages,
  achievements: Sparkles,
  references: UserCheck,
  volunteering: HeartHandshake,
  interests: Lightbulb,
  publications: BookOpen,
  custom: Plus,
};
const HINT_BY_TYPE: Record<string, string> = {
  projects: 'Things you built or led',
  certifications: 'Courses and certificates',
  languages: 'Languages you speak',
  achievements: 'Awards and big wins',
  references: 'People who can vouch for you',
  volunteering: 'Community or unpaid work',
  interests: 'Hobbies that show who you are',
  publications: 'Articles, papers or talks',
};
const SECTION_TYPE_MAP = {
  projects: 'projects',
  certifications: 'certifications',
  languages: 'languages',
  achievements: 'achievements',
  awards: 'achievements',
  references: 'references',
  volunteering: 'custom_volunteering',
  interests: 'custom_interests',
  publications: 'custom_publications',
} as const;

function toCustomSectionSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function optionKeyFromBackendType(type: string): string {
  const t = type.trim().toLowerCase();
  if (t === 'publications' || t === 'custom_publications')
    return 'publications';
  if (t === 'volunteering' || t === 'custom_volunteering')
    return 'volunteering';
  if (t === 'interests' || t === 'custom_interests') return 'interests';
  const match = Object.entries(SECTION_TYPE_MAP).find(([, v]) => v === t);
  if (match) return match[0];
  if (t.startsWith('custom_')) return 'custom';
  return t;
}

export type AddSectionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string | null;
  existingTypes: Set<string>;
  existingSections: CVSectionRecord[];
  /** Override modal stacking (e.g. when hosted inside a very-high-z overlay). */
  layerZIndex?: number;
};

function isAlreadyExistsError(e: unknown): boolean {
  if (axios.isAxiosError(e)) {
    const st = e.response?.status;
    if (st === 409) return true;
    const serverMsg = String(
      (e.response?.data as { error?: { message?: string } } | undefined)?.error
        ?.message ?? '',
    ).toLowerCase();
    if (serverMsg.includes('already') && serverMsg.includes('exist'))
      return true;
    const msg = String(getApiErrorMessage(e)).toLowerCase();
    if (
      msg.includes('already') &&
      (msg.includes('exist') || msg.includes('added'))
    )
      return true;
  }
  return false;
}

function getErrorStatus(e: unknown): number | null {
  if (!axios.isAxiosError(e)) return null;
  return e.response?.status ?? null;
}

export function AddSectionModal({
  open,
  onOpenChange,
  profileId,
  existingTypes: _existingTypes,
  existingSections,
  layerZIndex,
}: AddSectionModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [customSectionName, setCustomSectionName] = useState('');
  /** Types confirmed on CV this session (success or 409) so checkmarks update before refetch. */
  const [sessionOnCv, setSessionOnCv] = useState<Set<string>>(() => new Set());
  const prevOpen = useRef(open);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setSessionOnCv(new Set());
      setCustomSectionName('');
    }
    prevOpen.current = open;
  }, [open]);

  const presentTypes = useMemo(() => {
    const s = new Set(
      existingSections
        .filter((row) => row.hidden !== true)
        .map((row) => optionKeyFromBackendType(row.type)),
    );
    sessionOnCv.forEach((t) => s.add(t));
    return s;
  }, [existingSections, sessionOnCv]);

  const invalidateAfterSectionChange = (id: string) => {
    // Legacy + current query keys used in this workspace.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.cv.sectionsRoot(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.cv.sectionsActive(false),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.sections(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(id) });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.cv.profileDefault(),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
    // Backend-advised equivalents (safe even if not currently used).
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.sections(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
    void queryClient.refetchQueries({
      queryKey: queryKeys.cv.sections(id),
      type: 'active',
    });
    void queryClient.refetchQueries({
      queryKey: queryKeys.cv.sections(id),
      type: 'inactive',
    });
  };

  const ensureSectionVisibleForType = async (id: string, type: string) => {
    try {
      const all = await api.cv.getSections(true, id);
      const want = optionKeyFromBackendType(type);
      const match = all.find((s) => optionKeyFromBackendType(s.type) === want);
      if (match?.id && match.hidden === true) {
        await api.cv.updateSection(match.id, { visible: true }, id);
      }
    } catch {
      // Best-effort visibility repair; refetch still runs below.
    }
  };

  const add = async (sectionKey: string) => {
    if (!profileId?.trim()) {
      toast.error('No CV profile selected');
      return;
    }
    const mappedType =
      sectionKey === 'custom'
        ? (() => {
            const slug = toCustomSectionSlug(customSectionName);
            return slug ? `custom_${slug}` : 'custom';
          })()
        : SECTION_TYPE_MAP[sectionKey as keyof typeof SECTION_TYPE_MAP];

    if (!mappedType) {
      toast.error('Could not add that section. Please try again.');
      return;
    }

    setBusy(sectionKey);
    try {
      await savePendingCvEdits();
      const nice =
        sectionKey === 'custom'
          ? customSectionName.trim() || 'Custom section'
          : (LABEL_BY_TYPE[sectionKey] ?? sectionKey);
      const allRows = await api.cv.getSections(true, profileId);
      const want = optionKeyFromBackendType(mappedType);
      const hiddenMatch = allRows.find(
        (s) => optionKeyFromBackendType(s.type) === want && s.hidden === true,
      );
      if (hiddenMatch?.id) {
        await api.cv.updateSection(
          hiddenMatch.id,
          { visible: true },
          profileId,
        );
        try {
          await reorderNewSectionProfessionally(profileId, hiddenMatch.id);
        } catch {
          /* non-blocking */
        }
        setSessionOnCv((prev) => new Set(prev).add(sectionKey));
        invalidateAfterSectionChange(profileId);
        await queryClient.refetchQueries({
          queryKey: queryKeys.cv.profile(profileId),
          type: 'active',
        });
        await queryClient.refetchQueries({
          queryKey: queryKeys.cv.profile(profileId),
          type: 'inactive',
        });
        toast.success(`${nice} restored to your CV`);
        onOpenChange(false);
        return;
      }
      const added =
        sectionKey === 'custom'
          ? await api.cv.addSection(
              {
                type: 'custom',
                ...(customSectionName.trim()
                  ? { customTitle: customSectionName.trim() }
                  : {}),
              },
              profileId,
            )
          : await api.cv.addSection({ type: mappedType }, profileId);
      const resolvedType = added?.type?.trim() || mappedType;
      if (added?.id?.trim() && added.hidden === true) {
        await api.cv.updateSection(added.id, { visible: true }, profileId);
      } else {
        await ensureSectionVisibleForType(profileId, resolvedType);
      }
      const rowIdForOrder = added?.id?.trim();
      if (rowIdForOrder) {
        try {
          await reorderNewSectionProfessionally(profileId, rowIdForOrder);
        } catch {
          /* non-blocking */
        }
      }
      setSessionOnCv((prev) => new Set(prev).add(sectionKey));
      invalidateAfterSectionChange(profileId);
      await queryClient.refetchQueries({
        queryKey: queryKeys.cv.profile(profileId),
        type: 'active',
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.cv.profile(profileId),
        type: 'inactive',
      });
      toast.success(`${nice} added to your CV`);
      onOpenChange(false);
    } catch (e) {
      const status = getErrorStatus(e);
      if (status === 409 || isAlreadyExistsError(e)) {
        const nice =
          sectionKey === 'custom'
            ? customSectionName.trim() || 'Custom section'
            : (LABEL_BY_TYPE[sectionKey] ?? sectionKey);
        await ensureSectionVisibleForType(profileId, mappedType);
        setSessionOnCv((prev) => new Set(prev).add(sectionKey));
        invalidateAfterSectionChange(profileId);
        await queryClient.refetchQueries({
          queryKey: queryKeys.cv.profile(profileId),
          type: 'active',
        });
        await queryClient.refetchQueries({
          queryKey: queryKeys.cv.profile(profileId),
          type: 'inactive',
        });
        toast.success(`${nice} section is already in your CV`);
        onOpenChange(false);
        return;
      }
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add a section"
      titleClassName="font-display text-[22px] font-bold text-text-primary"
      description="Tap a section to add it. You can fill it in straight away on your CV."
      scrollBody
      className="max-w-2xl border border-border-subtle bg-bg-surface shadow-2xl"
      layerZIndex={layerZIndex}
    >
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {OPTIONAL.filter((s) => s.type !== 'custom').map((s) => {
          const on = presentTypes.has(s.type);
          const Icon = OPTIONAL_ICON_BY_TYPE[s.type] ?? Plus;
          const adding = busy === s.type;
          return (
            <li key={s.type}>
              <button
                type="button"
                disabled={on || busy !== null}
                onClick={() => void add(s.type)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition',
                  on
                    ? 'cursor-default border-border-subtle bg-bg-sunken'
                    : 'border-border-default bg-bg-surface hover:border-accent-border hover:bg-accent-subtle disabled:opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    on
                      ? 'bg-success-subtle text-success-text'
                      : 'bg-accent-subtle text-accent-text',
                  )}
                >
                  {on ? (
                    <Check className="h-5 w-5" aria-hidden />
                  ) : adding ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-text-primary">
                    {s.label}
                  </span>
                  <span className="block text-[13px] text-text-secondary">
                    {on ? 'On your CV' : HINT_BY_TYPE[s.type]}
                  </span>
                </span>
                {on ? null : (
                  <Plus
                    className="h-4 w-4 shrink-0 text-text-tertiary transition group-hover:text-accent-text"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-4 rounded-xl border border-dashed border-border-default p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (customSectionName.trim()) void add('custom');
        }}
      >
        <label
          htmlFor="add-section-custom-name"
          className="block text-[15px] font-semibold text-text-primary"
        >
          Something else?
        </label>
        <p className="text-[13px] text-text-secondary">
          Name your own section, like Conferences or Hobbies.
        </p>
        <div className="mt-2.5 flex gap-2">
          <input
            id="add-section-custom-name"
            type="text"
            value={customSectionName}
            maxLength={60}
            onChange={(e) => setCustomSectionName(e.target.value)}
            placeholder="Section name"
            className="h-11 min-w-0 flex-1 rounded-lg border border-border-default bg-bg-surface px-3 text-[15px] text-text-primary placeholder:text-text-tertiary focus:border-accent-solid focus:outline-none"
          />
          <Button
            type="submit"
            variant="accent"
            disabled={busy !== null || !customSectionName.trim()}
            className="h-11 shrink-0 px-5 text-[14px]"
          >
            {busy === 'custom' ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
