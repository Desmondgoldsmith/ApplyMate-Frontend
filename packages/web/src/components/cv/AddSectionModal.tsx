'use client';

import { queryKeys } from '@/lib/queryKeys';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  FileText,
  FolderKanban,
  GraduationCap,
  HeartHandshake,
  Languages,
  Lightbulb,
  Plus,
  Sparkles,
  UserCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { AddSectionPreviewCard } from '@/components/cv/AddSectionPreviewCard';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import type { CVSectionRecord } from '@/lib/api';
import { insertNewSectionIdProfessionally } from '@/lib/cvSectionProfessionalOrder';
import { useToast } from '@/components/ui/Toast';
import { getApiErrorMessage } from '@/lib/axios';
import { useQueryClient } from '@tanstack/react-query';

const CORE: { id: string; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
];

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

async function reorderNewSectionProfessionally(profileId: string, newSectionId: string): Promise<void> {
  const id = newSectionId?.trim();
  if (!id) return;
  const rows = await api.cv.getSections(true, profileId);
  if (!rows.some((r) => r.id === id)) return;
  const sortedByServer = [...rows].sort((a, b) => a.order - b.order).map((r) => r.id);
  const proposed = insertNewSectionIdProfessionally(rows, id);
  if (proposed.join('|') === sortedByServer.join('|')) return;
  await api.cv.reorderSections(proposed, profileId);
}

const LABEL_BY_TYPE = Object.fromEntries(OPTIONAL.map(({ type, label }) => [type, label]));
const CORE_ICON_BY_ID: Record<string, LucideIcon> = {
  summary: FileText,
  experience: Briefcase,
  education: GraduationCap,
  skills: Wrench,
};
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
const PREVIEW_BY_KEY: Record<string, string[]> = {
  summary: ['Professional snapshot', 'Strengths + impact'],
  experience: ['Role, company, period', 'Measurable achievements'],
  education: ['Degree and school', 'Date range'],
  skills: ['Skill groups', 'Core tools / stack'],
  projects: ['Project title + outcome', 'Tech and contribution'],
  certifications: ['Certificate + issuer', 'Date / credential'],
  languages: ['Language + proficiency', 'CEFR / fluency level'],
  achievements: ['Award / milestone', 'Context and result'],
  references: ['Name + role', 'Contact details'],
  volunteering: ['Organization + role', 'Impact bullets'],
  interests: ['Relevant interests', 'Culture-fit signals'],
  publications: ['Title + venue', 'Date / link'],
  custom: ['Choose your own block', 'Tailor to your story'],
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
  if (t === 'publications' || t === 'custom_publications') return 'publications';
  if (t === 'volunteering' || t === 'custom_volunteering') return 'volunteering';
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
    const serverMsg = String((e.response?.data as { error?: { message?: string } } | undefined)?.error?.message ?? '').toLowerCase();
    if (serverMsg.includes('already') && serverMsg.includes('exist')) return true;
    const msg = String(getApiErrorMessage(e)).toLowerCase();
    if (msg.includes('already') && (msg.includes('exist') || msg.includes('added'))) return true;
  }
  return false;
}

function getErrorStatus(e: unknown): number | null {
  if (!axios.isAxiosError(e)) return null;
  return e.response?.status ?? null;
}

export function AddSectionModal({ open, onOpenChange, profileId, existingTypes, existingSections, layerZIndex }: AddSectionModalProps) {
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

  /**
   * Core sections (Summary, Experience, Education, Skills) are always shown on the CV —
   * deletion is disabled and any legacy `visible:false` row is ignored by the preview.
   * Render them as plainly checked so users don't see a confusing "Restore" affordance.
   */
  const hiddenCoreByKey = useMemo<Record<string, string>>(() => ({}), []);

  const invalidateAfterSectionChange = (id: string) => {
    // Legacy + current query keys used in this workspace.
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.sectionsRoot() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.sectionsActive(false) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.sections(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
    // Backend-advised equivalents (safe even if not currently used).
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.sections(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
    void queryClient.refetchQueries({ queryKey: queryKeys.cv.sections(id), type: 'active' });
    void queryClient.refetchQueries({ queryKey: queryKeys.cv.sections(id), type: 'inactive' });
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
      const nice = sectionKey === 'custom' ? customSectionName.trim() || 'Custom section' : LABEL_BY_TYPE[sectionKey] ?? sectionKey;
      const allRows = await api.cv.getSections(true, profileId);
      const want = optionKeyFromBackendType(mappedType);
      const hiddenMatch = allRows.find((s) => optionKeyFromBackendType(s.type) === want && s.hidden === true);
      if (hiddenMatch?.id) {
        await api.cv.updateSection(hiddenMatch.id, { visible: true }, profileId);
        try {
          await reorderNewSectionProfessionally(profileId, hiddenMatch.id);
        } catch {
          /* non-blocking */
        }
        setSessionOnCv((prev) => new Set(prev).add(sectionKey));
        invalidateAfterSectionChange(profileId);
        await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId), type: 'active' });
        await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId), type: 'inactive' });
        toast.success(`${nice} restored to your CV`);
        onOpenChange(false);
        return;
      }
      const added =
        sectionKey === 'custom'
          ? await api.cv.addSection(
              {
                type: 'custom',
                ...(customSectionName.trim() ? { customTitle: customSectionName.trim() } : {}),
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
      await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId), type: 'active' });
      await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId), type: 'inactive' });
      toast.success(`${nice} added to your CV`);
      onOpenChange(false);
    } catch (e) {
      const status = getErrorStatus(e);
      if (status === 409 || isAlreadyExistsError(e)) {
        const nice = sectionKey === 'custom' ? customSectionName.trim() || 'Custom section' : LABEL_BY_TYPE[sectionKey] ?? sectionKey;
        await ensureSectionVisibleForType(profileId, mappedType);
        setSessionOnCv((prev) => new Set(prev).add(sectionKey));
        invalidateAfterSectionChange(profileId);
        await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId), type: 'active' });
        await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId), type: 'inactive' });
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
      titleClassName="text-2xl font-extrabold tracking-tight"
      description="Core sections are always on your CV. Optional blocks can be added or removed."
      scrollBody
      className="max-w-3xl border border-white/[0.08] bg-[#1a1a1a] shadow-2xl"
      layerZIndex={layerZIndex}
    >
      <div className="pr-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Core</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
          {CORE.map((s) => (
            <AddSectionPreviewCard
              key={s.id}
              label={s.label}
              icon={CORE_ICON_BY_ID[s.id] ?? FileText}
              checked={!hiddenCoreByKey[s.id]}
              locked
              preview={PREVIEW_BY_KEY[s.id] ?? PREVIEW_BY_KEY.summary}
              footer={
                hiddenCoreByKey[s.id] ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={async () => {
                      if (!profileId?.trim()) return;
                      const rowId = hiddenCoreByKey[s.id];
                      if (!rowId) return;
                      setBusy(s.id);
                      try {
                        await api.cv.updateSection(rowId, { visible: true }, profileId);
                        invalidateAfterSectionChange(profileId);
                        await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId), type: 'active' });
                        await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId), type: 'inactive' });
                        toast.success(`${s.label} restored`);
                        onOpenChange(false);
                      } catch (e) {
                        toast.error(getApiErrorMessage(e));
                      } finally {
                        setBusy(null);
                      }
                    }}
                    className="h-8 w-full rounded-lg border border-[#2DD4BF]/70 px-3 text-[11px] font-semibold text-[#2DD4BF] hover:bg-[#2DD4BF]/10"
                  >
                    {busy === s.id ? 'Restoring…' : 'Restore section'}
                  </Button>
                ) : (
                  <p className="text-[11px] font-medium text-white/45">Always included in your CV</p>
                )
              }
            />
          ))}
        </div>

        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Optional</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {OPTIONAL.map((s) => {
            const on = presentTypes.has(s.type);
            const Icon = OPTIONAL_ICON_BY_TYPE[s.type] ?? Plus;
            return (
              <AddSectionPreviewCard
                key={s.type}
                label={s.label}
                icon={Icon}
                checked={on}
                preview={PREVIEW_BY_KEY[s.type] ?? PREVIEW_BY_KEY.custom}
                customBody={
                  on ? (
                    <p className="text-[11px] font-medium text-white/45">Already available in your CV preview</p>
                  ) : s.type === 'custom' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={customSectionName}
                        onChange={(e) => setCustomSectionName(e.target.value)}
                        placeholder="Section name (e.g. Conferences)"
                        className="w-full rounded-md border border-white/[0.12] bg-[#0C0F0F]/90 px-2 py-1.5 text-[11px] text-white placeholder:text-white/35 focus:border-[#2DD4BF]/70 focus:outline-none"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => void add(s.type)}
                        className="h-8 w-full rounded-lg border border-[#2DD4BF]/70 px-4 text-xs font-semibold text-[#2DD4BF] hover:bg-[#2DD4BF]/10"
                      >
                        {busy === s.type ? 'Adding…' : 'Create custom section'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => void add(s.type)}
                      className="h-8 w-full rounded-lg border border-[#2DD4BF]/70 px-4 text-xs font-semibold text-[#2DD4BF] hover:bg-[#2DD4BF]/10"
                    >
                      {busy === s.type ? 'Adding…' : `Add ${s.label}`}
                    </Button>
                  )
                }
              />
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
