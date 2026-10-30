'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Expand, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CVDocumentPreview } from '@/components/cv/CVDocumentPreview';
import { PortalThemeScope } from '@/components/theme/ThemeScope';
import { Button } from '@/components/ui/Button';
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

/** Width of an element, kept current as the layout changes. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A design thumbnail that fills the width of its card. */
function FluidPreview({
  data,
  template,
}: {
  data: CVBuilderData;
  template: CvTemplateId;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return (
    <div ref={ref} className="w-full">
      {width > 0 ? (
        <ScaledPreview data={data} template={template} width={width} />
      ) : (
        <div className="aspect-[794/1123] w-full bg-white" />
      )}
    </div>
  );
}

/** Full-size A4 view of one design, scaled to fit the screen width. */
function FullSizePreview({
  data,
  template,
  onClose,
}: {
  data: CVBuilderData;
  template: CvTemplateId;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [frameRef, frameWidth] = useElementWidth<HTMLDivElement>();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <PortalThemeScope>
      <div
        className="fixed inset-0 z-[120] flex flex-col bg-bg-overlay backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={`${TEMPLATE_META[template].name} design, full size`}
        onClick={onClose}
        data-lenis-prevent
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
          <p className="rounded-full bg-bg-raised px-3 py-1.5 text-[14px] font-semibold text-text-primary shadow-raised">
            {TEMPLATE_META[template].name} design
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-raised text-text-primary shadow-raised transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6"
          data-lenis-prevent-wheel
        >
          <div
            ref={frameRef}
            className="mx-auto w-full max-w-[794px]"
            onClick={(e) => e.stopPropagation()}
          >
            {frameWidth > 0 ? (
              <div className="overflow-hidden rounded-lg shadow-overlay">
                <ScaledPreview
                  data={data}
                  template={template}
                  width={frameWidth}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PortalThemeScope>,
    document.body,
  );
}

/** "Choose a design": a large live preview plus every design, rendered with the user's CV. */
export function OnboardingTemplateChooser({
  data,
  selected,
  onSelect,
  onConfirm,
  saving,
  confirmLabel,
}: {
  /** The user's parsed CV; falls back to sample content (e.g. before a CV exists). */
  data: CVBuilderData | null;
  selected: CvTemplateId;
  onSelect: (t: CvTemplateId) => void;
  onConfirm: () => void;
  saving: boolean;
  /** Overrides "Use {design}" (e.g. "Continue with Modern"). */
  confirmLabel?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [fullSize, setFullSize] = useState(false);
  const closeFullSize = useCallback(() => setFullSize(false), []);
  const [previewRef, previewWidth] = useElementWidth<HTMLDivElement>();
  const previewFor = (t: CvTemplateId) =>
    data ? ensureCvPreviewData(data) : cvTemplatePreviewSampleDataFor(t);
  const usingSample = !data;

  return (
    <div className="w-full text-left">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] sm:items-start lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:gap-6">
        {/* Large live preview: under the designs on phones, beside them from tablet width up. */}
        <div className="order-2 sm:sticky sm:top-6 sm:order-none sm:col-start-2 sm:row-start-1">
          <div className="rounded-3xl border border-border-subtle bg-bg-surface p-4 shadow-raised">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-text-primary">
                  {TEMPLATE_META[selected].name}
                </p>
                <p className="text-[13px] text-text-secondary">
                  {usingSample
                    ? 'Shown with sample content'
                    : 'Shown with your own CV'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFullSize(true)}
                className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-border-default bg-bg-surface px-3 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                <Expand className="h-4 w-4" aria-hidden />
                View full size
              </button>
            </div>
            <div
              ref={previewRef}
              className="mx-auto w-full max-w-[360px] sm:max-w-none"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.button
                  key={selected}
                  type="button"
                  onClick={() => setFullSize(true)}
                  aria-label={`View the ${TEMPLATE_META[selected].name} design full size`}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-border-subtle shadow-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                >
                  {previewWidth > 0 ? (
                    <ScaledPreview
                      data={previewFor(selected)}
                      template={selected}
                      width={previewWidth}
                    />
                  ) : (
                    <div className="aspect-[794/1123] w-full bg-white" />
                  )}
                </motion.button>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Design options: a swipeable strip on phones, a grid on larger screens. */}
        <div className="order-1 min-w-0 sm:order-none sm:col-start-1 sm:row-start-1">
          <p className="mb-3 text-[14px] font-semibold text-text-primary">
            {ORDERED_TEMPLATES.length} designs.{' '}
            <span className="font-normal text-text-secondary sm:hidden">
              Swipe to see them all, tap one to preview it.
            </span>
            <span className="hidden font-normal text-text-secondary sm:inline">
              Tap one to preview it.
            </span>
          </p>
          <div
            className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
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
                    'group relative flex w-[150px] shrink-0 snap-start flex-col items-center overflow-hidden rounded-2xl border p-3 text-left transition-[border-color,box-shadow,background-color] duration-200 sm:w-auto',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
                    isSelected
                      ? 'border-border-focus bg-accent-subtle shadow-[0_0_0_1px_var(--ck-border-focus),0_0_0_5px_var(--ck-accent-subtle)]'
                      : 'border-border-default bg-bg-surface shadow-raised hover:border-border-strong',
                  )}
                >
                  {meta.badge ? (
                    <span className="absolute left-2.5 top-2.5 z-10 rounded-full border border-border-default bg-bg-raised px-2 py-0.5 text-[11px] font-semibold text-text-primary shadow-raised">
                      {meta.badge}
                    </span>
                  ) : null}
                  {isSelected ? (
                    <span className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent-solid text-text-on-accent shadow-raised">
                      <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                    </span>
                  ) : null}
                  <div className="w-full overflow-hidden rounded-md border border-border-subtle transition-transform duration-300 group-hover:scale-[1.02]">
                    <FluidPreview data={previewFor(t)} template={t} />
                  </div>
                  <span className="mt-3 w-full text-[14px] font-semibold text-text-primary">
                    {meta.name}
                  </span>
                  <span className="mt-0.5 w-full text-[12px] leading-snug text-text-secondary">
                    {meta.blurb}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <p className="text-[13px] text-text-tertiary">
          You can switch designs anytime. Your content stays the same.
        </p>
        <Button
          type="button"
          variant="accent"
          onClick={onConfirm}
          disabled={saving}
          className="w-full gap-2 px-8 sm:w-auto"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {confirmLabel ?? `Use ${TEMPLATE_META[selected].name}`}
        </Button>
      </div>

      {fullSize ? (
        <FullSizePreview
          data={previewFor(selected)}
          template={selected}
          onClose={closeFullSize}
        />
      ) : null}
    </div>
  );
}
