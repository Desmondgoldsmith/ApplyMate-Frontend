'use client';

type Props = {
  /** Resolved section title (normalized → payload → “Your Landscape”). */
  title: string;
  /** Backend-authored coaching copy; rendered verbatim (whitespace preserved). */
  body: string | null;
  emptyStateCopy?: string | null;
};

/**
 * Reflective “Your Landscape” coaching block — eyebrow is fixed product copy per dashboard spec.
 */
export function DashboardLandscapeCard({ title, body, emptyStateCopy }: Props) {
  const raw = body ?? '';
  const hasBody = raw.length > 0;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 sm:p-6">
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-white/38">A quick perspective</p>
        <p className="mt-2 text-[15px] font-medium leading-snug text-white/88">{title}</p>
        {hasBody ? (
          <p className="mt-2 text-[13px] leading-relaxed text-white/85 whitespace-pre-wrap">{raw}</p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-white/52">
            {emptyStateCopy?.trim() ||
              'When your search picks up momentum, a short readout of where you stand will appear here.'}
          </p>
        )}
      </div>
    </section>
  );
}
