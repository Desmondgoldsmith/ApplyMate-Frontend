'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Loader2 } from 'lucide-react';

import { CVDocumentPreview } from '@/components/cv/CVDocumentPreview';
import {
  CV_TEMPLATE_IDS,
  cvTemplatePreviewSampleDataFor,
  ensureCvPreviewData,
  type CVBuilderData,
  type CvTemplateId,
} from '@/lib/cvBuilder';
import { cn } from '@/lib/utils';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

const TEMPLATE_META: Record<
  CvTemplateId,
  { name: string; blurb: string; badge?: string }
> = {
  modern: {
    name: 'Modern',
    blurb: 'Two columns, works for most roles',
    badge: 'Most popular',
  },
  classic: {
    name: 'Classic',
    blurb: 'Simple single column, very ATS-friendly',
  },
  professional: {
    name: 'Professional',
    blurb: 'Structured skills, great for technical roles',
  },
  creative: { name: 'Creative', blurb: 'Bold headings that stand out' },
  onyx: { name: 'Onyx', blurb: 'Dark sidebar with room for a photo' },
};

/** Modern first (default), then the rest in the canonical order. */
const ORDERED_TEMPLATES: CvTemplateId[] = [
  'modern',
  ...CV_TEMPLATE_IDS.filter((t) => t !== 'modern'),
];

function ScaledPreview({
  data,
  template,
  width,
}: {
  data: CVBuilderData;
  template: CvTemplateId;
  width: number;
}) {
  const scale = width / A4_WIDTH;
  return (
    <div
      className="pointer-events-none relative overflow-hidden rounded-md bg-white"
      style={{ width, height: Math.round(A4_HEIGHT * scale) }}
      aria-hidden
    >
      <div
        style={{
          width: A4_WIDTH,
          height: A4_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <CVDocumentPreview
          data={data}
          template={template}
          activeSection={null}
        />
      </div>
    </div>
  );
}

/** "Choose a design" — every template is rendered with the user's own CV. */
export function OnboardingTemplateChooser({
  data,
  selected,
  onSelect,
  onConfirm,
  saving,
}: {
  /** The user's parsed CV; falls back to sample content while it loads. */
  data: CVBuilderData | null;
  selected: CvTemplateId;
  onSelect: (t: CvTemplateId) => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const previewFor = (t: CvTemplateId) =>
    data ? ensureCvPreviewData(data) : cvTemplatePreviewSampleDataFor(t);

  return (
    <div className="w-full">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          role="radiogroup"
          aria-label="CV designs"
        >
          {ORDERED_TEMPLATES.map((t, i) => {
            const isSelected = t === selected;
            const meta = TEMPLATE_META[t];
            return (
              <motion.button
                key={t}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelect(t)}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: reducedMotion ? 0 : i * 0.05,
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={reducedMotion ? undefined : { y: -3 }}
                className={cn(
                  'group relative flex flex-col items-center overflow-hidden rounded-2xl border p-3 text-left transition-colors duration-200',
                  isSelected
                    ? 'border-[#00C9B1] bg-[rgba(0,201,177,0.08)] shadow-[0_0_0_1px_rgba(0,201,177,0.55),0_14px_40px_rgba(0,201,177,0.15)]'
                    : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.22]',
                )}
              >
                {meta.badge ? (
                  <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1a1203]">
                    {meta.badge}
                  </span>
                ) : null}
                {isSelected ? (
                  <span className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#00C9B1] shadow-lg">
                    <Check
                      className="h-3.5 w-3.5 text-[#080A0A]"
                      strokeWidth={3.5}
                    />
                  </span>
                ) : null}
                <div className="w-full overflow-hidden rounded-md ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-[1.02]">
                  <ScaledPreview
                    data={previewFor(t)}
                    template={t}
                    width={150}
                  />
                </div>
                <span className="mt-3 w-full text-[14px] font-semibold text-white">
                  {meta.name}
                </span>
                <span className="mt-0.5 w-full text-[12px] leading-snug text-white/50">
                  {meta.blurb}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">
              Preview · {TEMPLATE_META[selected].name}
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
              >
                <ScaledPreview
                  data={previewFor(selected)}
                  template={selected}
                  width={306}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <p className="text-[12px] text-white/40">
          You can switch designs anytime. Your content stays the same.
        </p>
        <motion.button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          whileHover={saving ? undefined : { y: -1 }}
          whileTap={saving ? undefined : { scale: 0.98 }}
          className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00C9B1] px-6 text-[14px] font-semibold text-[#080A0A] shadow-[0_8px_30px_rgba(0,201,177,0.25)] transition-shadow hover:shadow-[0_10px_36px_rgba(0,201,177,0.38)] disabled:opacity-60 sm:w-auto"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Use {TEMPLATE_META[selected].name}
          {!saving ? (
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.5}
            />
          ) : null}
        </motion.button>
      </div>
    </div>
  );
}
