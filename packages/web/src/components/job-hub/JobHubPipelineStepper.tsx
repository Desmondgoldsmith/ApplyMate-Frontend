'use client';

import { cn } from '@/lib/utils';
import type { JobHubPipelineStep, JobHubPipelineStepperPayload } from '@/lib/jobHubGuidance';

type Props = {
  stepper: JobHubPipelineStepperPayload;
  onStepClick: (step: JobHubPipelineStep) => void;
  disabled?: boolean;
  /** Detail panel uses a low-height chevron bar. */
  compact?: boolean;
};

function stepClasses(state: JobHubPipelineStep['state'], clickable: boolean): string {
  if (state === 'complete') {
    return 'bg-[#00C9B1]/28 text-[#00C9B1]';
  }
  if (state === 'current') {
    return 'bg-[rgba(0,201,177,0.16)] text-[#00C9B1] ring-1 ring-inset ring-[#00C9B1]/40';
  }
  if (state === 'unavailable' || !clickable) {
    return 'bg-[#111616] text-white/28';
  }
  return 'bg-[#111616] text-white/42 hover:bg-[#00C9B1]/12 hover:text-[#00C9B1]/90';
}

export function JobHubPipelineStepper({ stepper, onStepClick, disabled, compact = false }: Props) {
  const steps = stepper.steps;
  const hint = stepper.statusHint?.trim();

  return (
    <div className={cn('min-w-0', compact ? 'space-y-0.5' : 'space-y-2')}>
      <div
        className="overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]"
        role="list"
        aria-label="Application pipeline"
      >
        <div className={cn('flex gap-0', compact ? 'min-w-[min(100%,480px)]' : 'min-w-[min(100%,640px)]')}>
          {steps.map((step, index) => {
            const label = step.shortLabel?.trim() || step.label;
            const isCurrent = step.id === stepper.currentStepId;
            const canClick =
              !disabled && !stepper.terminal && step.state !== 'unavailable';
            return (
              <button
                key={step.id}
                type="button"
                role="listitem"
                disabled={!canClick}
                aria-current={isCurrent ? 'step' : undefined}
                title={step.label}
                style={{ zIndex: steps.length - index }}
                onClick={() => {
                  if (canClick) onStepClick(step);
                }}
                className={cn(
                  compact ? 'pipeline-chevron-compact' : 'pipeline-chevron',
                  'relative flex flex-1 shrink-0 items-center justify-center px-0.5 text-center transition-colors',
                  stepClasses(step.state, canClick),
                  !canClick && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'block font-semibold uppercase tracking-[0.04em]',
                    compact ? 'text-[8px] leading-none sm:text-[9px]' : 'text-[10px] sm:text-[11px]',
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {hint ? (
        <p className={cn('truncate text-white/38', compact ? 'text-[10px]' : 'text-[11px]')}>{hint}</p>
      ) : null}
    </div>
  );
}
