'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { motion } from 'framer-motion';

import { CVDocumentPreview } from '@/components/cv/CVDocumentPreview';
import { GlowCard } from '@/components/ui/GlowCard';
import { CV_TEMPLATE_IDS, cvTemplatePreviewSampleData, type CvTemplateId } from '@/lib/cvBuilder';
import { cn } from '@/lib/utils';

const PREVIEW_SAMPLE = cvTemplatePreviewSampleData();

/** Same labels as CV clinic `TemplatePickerModal` (grid layout). */
export const ONBOARDING_TEMPLATE_LABELS: Record<CvTemplateId, string> = {
  classic: 'Classic',
  modern: 'Modern',
  creative: 'Creative',
  professional: 'Professional',
  'europass-classic': 'Europass Classic',
  'europass-modern': 'Europass Modern',
  french: 'French resume',
  german: 'German Lebenslauf',
  uk: 'UK resume',
};

/** @deprecated Use {@link ONBOARDING_TEMPLATE_LABELS} */
const CLINIC_GRID_LABELS = ONBOARDING_TEMPLATE_LABELS;

export function getOnboardingTemplateLabel(id: string): string {
  if (id in ONBOARDING_TEMPLATE_LABELS) return ONBOARDING_TEMPLATE_LABELS[id as CvTemplateId];
  return id;
}

/** Horizontal padding of the card grid — arrows sit in the outer margin. */
export const TEMPLATE_PICKER_CAROUSEL_GUTTER_X = 'px-10 sm:px-11';

/**
 * Left inset for headings/copy that should line up with the first template card’s left edge.
 * Must stay in sync with {@link TEMPLATE_PICKER_CAROUSEL_GUTTER_X} (same spacing values).
 */
export const TEMPLATE_PICKER_CARD_START_INSET = 'pl-10 sm:pl-11';

const TEMPLATES = [
  {
    id: 'classic' as const,
    name: 'Classic',
    description: 'Clean and ATS-friendly',
    bestFor: 'Corporate & traditional roles',
  },
  {
    id: 'modern' as const,
    name: 'Modern',
    description: 'Two-column professional layout',
    bestFor: 'Tech, business & most industries',
    badge: 'Most Popular',
  },
  {
    id: 'creative' as const,
    name: 'Creative',
    description: 'Bold typography, stands out',
    bestFor: 'Design, marketing & creative roles',
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    description: 'Traditional single-column with structured skills',
    bestFor: 'Engineering, DevOps & technical roles',
  },
  {
    id: 'europass-classic' as const,
    name: 'Europass Classic',
    description: 'Official EU format — single column',
    bestFor: 'EU public sector, academia, Eastern Europe',
  },
  {
    id: 'europass-modern' as const,
    name: 'Europass Modern',
    description: 'Official EU format — two column sidebar',
    bestFor: 'EU job market, international applications',
    badge: 'EU Standard',
  },
  {
    id: 'french' as const,
    name: 'French resume',
    description: 'French format — elegant, photo-ready',
    bestFor: 'France and French-speaking markets',
  },
  {
    id: 'german' as const,
    name: 'German Lebenslauf',
    description: 'Structured formal layout with photo block',
    bestFor: 'Germany, Austria, Switzerland',
  },
  {
    id: 'uk' as const,
    name: 'UK resume',
    description: 'British format with strong personal profile',
    bestFor: 'United Kingdom, Ireland, Commonwealth',
  },
];

export type TemplatePickerProps = {
  selectedTemplate: string;
  onSelect: (template: string) => void;
  showHeader?: boolean;
  /** `clinicGrid` matches the CV clinic template modal: 2×3 grid with scaled previews. */
  layout?: 'carousel' | 'clinicGrid' | 'onboardingGrid';
};

function TemplatePickerOnboardingGrid({
  selectedTemplate,
  onSelect,
  showHeader,
}: Pick<TemplatePickerProps, 'selectedTemplate' | 'onSelect' | 'showHeader'>) {
  return (
    <div className="w-full space-y-3">
      {showHeader ? (
        <>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#00C9B1]">
            Choose your resume style
          </p>
          <p className="text-xs text-white/25">You can change this anytime</p>
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
        {CV_TEMPLATE_IDS.map((tid) => {
          const selected = selectedTemplate === tid;
          return (
            <motion.button
              key={tid}
              type="button"
              layout
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.1 }}
              onClick={() => onSelect(tid)}
              className={cn(
                'relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-[rgba(255,255,255,0.03)] text-left transition-colors duration-200',
                selected
                  ? 'border-2 border-[#00C9B1]'
                  : 'border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)]',
              )}
            >
              {selected ? (
                <span
                  className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#00C9B1] shadow-md"
                  aria-hidden
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              ) : null}
              <div
                className="pointer-events-none relative mx-auto mt-2 overflow-hidden rounded border border-white/10 bg-white"
                style={{ width: 120, height: 170 }}
              >
                <div
                  className="origin-top-left"
                  style={{
                    width: 794,
                    height: 1123,
                    transform: 'scale(0.15)',
                    transformOrigin: 'top left',
                  }}
                >
                  <CVDocumentPreview data={PREVIEW_SAMPLE} template={tid} activeSection={null} />
                </div>
              </div>
              <span className="px-2 pb-3 pt-2.5 text-center text-[13px] font-medium text-[rgba(255,255,255,0.8)]">
                {ONBOARDING_TEMPLATE_LABELS[tid]}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function TemplatePickerClinicGrid({
  selectedTemplate,
  onSelect,
  showHeader,
}: Pick<TemplatePickerProps, 'selectedTemplate' | 'onSelect' | 'showHeader'>) {
  return (
    <div className="w-full space-y-3">
      {showHeader ? (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Choose your resume style</p>
          <p className="text-xs text-white/25">You can change this anytime</p>
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CV_TEMPLATE_IDS.map((tid) => {
          const selected = selectedTemplate === tid;
          return (
            <motion.button
              key={tid}
              type="button"
              layout
              onClick={() => onSelect(tid)}
              className={cn(
                'flex min-h-0 flex-col overflow-hidden rounded-xl border bg-[#080B0B] text-left transition',
                selected
                  ? 'border-[#00C9B1] ring-1 ring-[#00C9B1]/40'
                  : 'border-white/[0.08] hover:border-white/20',
              )}
            >
              <div
                className="pointer-events-none relative mx-auto mt-2 overflow-hidden rounded border border-white/10 bg-white"
                style={{ width: 120, height: 170 }}
              >
                <div
                  className="origin-top-left"
                  style={{
                    width: 794,
                    height: 1123,
                    transform: 'scale(0.15)',
                    transformOrigin: 'top left',
                  }}
                >
                  <CVDocumentPreview data={PREVIEW_SAMPLE} template={tid} activeSection={null} />
                </div>
              </div>
              <span className="border-t border-white/[0.06] px-2 py-2 text-center text-xs font-medium capitalize text-white/80">
                {CLINIC_GRID_LABELS[tid]}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function TemplatePicker({
  selectedTemplate,
  onSelect,
  showHeader = true,
  layout = 'carousel',
}: TemplatePickerProps) {
  if (layout === 'onboardingGrid') {
    return (
      <TemplatePickerOnboardingGrid
        selectedTemplate={selectedTemplate}
        onSelect={onSelect}
        showHeader={showHeader}
      />
    );
  }
  if (layout === 'clinicGrid') {
    return <TemplatePickerClinicGrid selectedTemplate={selectedTemplate} onSelect={onSelect} showHeader={showHeader} />;
  }

  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setVisibleCount(mq.matches ? 1 : 3);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    setStartIndex((prev) => Math.min(prev, Math.max(0, TEMPLATES.length - visibleCount)));
  }, [visibleCount]);

  const canGoBack = startIndex > 0;
  const canGoForward = startIndex + visibleCount < TEMPLATES.length;
  const visibleTemplates = TEMPLATES.slice(startIndex, startIndex + visibleCount);

  const goBack = useCallback(() => {
    setStartIndex((i) => Math.max(0, i - 1));
  }, []);

  const goForward = useCallback(() => {
    setStartIndex((i) => Math.min(TEMPLATES.length - visibleCount, i + 1));
  }, [visibleCount]);

  return (
    <div className="w-full space-y-3">
      {showHeader ? (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Choose your resume style</p>
          <p className="text-xs text-white/25">You can change this anytime</p>
        </>
      ) : null}

      <div className="relative mt-4">
        <button
          type="button"
          aria-label="Previous templates"
          disabled={!canGoBack}
          onClick={goBack}
          className={cn(
            'absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border text-white/55 transition sm:h-9 sm:w-9',
            'border-[rgba(0,201,177,0.3)] bg-transparent',
            canGoBack
              ? 'cursor-pointer hover:border-[rgba(0,201,177,0.6)] hover:text-white'
              : 'cursor-not-allowed opacity-20',
          )}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>

        <div
          className={cn(
            'grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4',
            TEMPLATE_PICKER_CAROUSEL_GUTTER_X,
          )}
        >
          {visibleTemplates.map((tpl) => {
            const selected = selectedTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelect(tpl.id)}
                className={cn('min-w-0 text-left transition-transform', selected ? 'scale-[1.02]' : '')}
              >
                <GlowCard
                  className={cn(
                    'h-full w-full border transition-all',
                    selected
                      ? 'border-[rgba(0,201,177,0.55)] bg-[rgba(0,201,177,0.08)] shadow-[0_0_24px_rgba(0,201,177,0.14)]'
                      : 'border-[rgba(0,201,177,0.15)] hover:border-[rgba(0,201,177,0.4)]',
                  )}
                  contentClassName="relative p-3"
                >
                  {selected ? (
                    <span
                      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#00C9B1] text-[#080A0A] shadow-md"
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                  <div className="relative mb-3 h-[220px] w-full overflow-hidden rounded-lg border border-white/10 bg-white">
                    <div
                      className="pointer-events-none absolute left-1/2 top-2 w-[220%] max-w-none origin-top"
                      style={{ transform: 'translateX(-50%) scale(0.45)' }}
                      aria-hidden
                    >
                      <CVDocumentPreview data={PREVIEW_SAMPLE} template={tpl.id} activeSection={null} />
                    </div>
                  </div>
                  <div className="space-y-1 pr-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-white">{tpl.name}</p>
                      {tpl.badge ? (
                        <span className="rounded-full border border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#00C9B1]">
                          {tpl.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-white/55">{tpl.description}</p>
                    <p className="text-[11px] text-white/30">Best for: {tpl.bestFor}</p>
                  </div>
                </GlowCard>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Next templates"
          disabled={!canGoForward}
          onClick={goForward}
          className={cn(
            'absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border text-white/55 transition sm:h-9 sm:w-9',
            'border-[rgba(0,201,177,0.3)] bg-transparent',
            canGoForward
              ? 'cursor-pointer hover:border-[rgba(0,201,177,0.6)] hover:text-white'
              : 'cursor-not-allowed opacity-20',
          )}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="flex justify-center gap-1.5 pt-2">
        {TEMPLATES.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 w-1.5 rounded-full transition-colors duration-200',
              i >= startIndex && i < startIndex + visibleCount ? 'bg-[#00C9B1]' : 'bg-white/20',
            )}
          />
        ))}
      </div>
    </div>
  );
}
