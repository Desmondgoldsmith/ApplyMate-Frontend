'use client';

import { Check, ChevronDown, Lightbulb, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  isGuidanceTaskDone,
  isGuidanceTaskUserToggleable,
  type JobHubGuidancePayload,
  type JobHubGuidanceTask,
} from '@/lib/jobHubGuidance';
import { cn } from '@/lib/utils';

type Props = {
  guidance: JobHubGuidancePayload;
  onToggleTask?: (taskId: string, userCompleted: boolean) => void;
  togglePendingTaskId?: string | null;
  onNavigate?: (href: string) => void;
};

function TaskRow({
  task,
  selected,
  onSelect,
  onToggle,
  togglePending,
  compact,
}: {
  task: JobHubGuidanceTask;
  selected: boolean;
  onSelect: () => void;
  onToggle?: (completed: boolean) => void;
  togglePending: boolean;
  compact?: boolean;
}) {
  const done = isGuidanceTaskDone(task);
  const blocked = task.state === 'blocked';
  const canToggle = Boolean(onToggle) && isGuidanceTaskUserToggleable(task) && !blocked;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border text-left transition-colors',
        compact ? 'px-2 py-2' : 'gap-2.5 px-3 py-2.5',
        selected
          ? 'border-[#00C9B1]/40 bg-[#00C9B1]/10'
          : 'border-transparent bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex shrink-0 items-center justify-center rounded border',
          compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
          done
            ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
            : 'border-white/20 bg-transparent',
          blocked && 'opacity-50',
          !canToggle && done && 'cursor-default',
        )}
        onClick={(e) => {
          if (!canToggle) return;
          e.stopPropagation();
          onToggle?.(!done);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        role={canToggle ? 'checkbox' : undefined}
        aria-checked={canToggle ? done : undefined}
        aria-label={canToggle ? `Mark "${task.label}" complete` : undefined}
      >
        {togglePending ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-white/50" />
        ) : done ? (
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-medium leading-snug',
            compact ? 'text-[12px]' : 'text-[13px]',
            done ? 'text-white/55 line-through' : 'text-white/88',
          )}
        >
          {task.label}
        </span>
        {task.scheduledLabel?.trim() ? (
          <span className="mt-0.5 block text-[10px] text-[#00C9B1]/75">{task.scheduledLabel.trim()}</span>
        ) : null}
      </span>
    </button>
  );
}

export function JobHubGuidancePanel({
  guidance,
  onToggleTask,
  togglePendingTaskId,
  onNavigate,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const tasks = guidance.tasks;
  const selectedTask = useMemo(() => {
    const id = selectedTaskId ?? tasks.find((t) => !isGuidanceTaskDone(t))?.id ?? tasks[0]?.id;
    return tasks.find((t) => t.id === id) ?? tasks[0] ?? null;
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    if (!expanded) return;
    const onDoc = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [expanded]);

  if (!tasks.length) return null;

  const handleCta = (href: string) => {
    setExpanded(false);
    if (onNavigate) {
      onNavigate(href);
      return;
    }
    window.location.assign(href);
  };

  return (
    <div ref={panelRef} className="relative min-w-0 w-full">
      <button
        type="button"
        className={cn(
          'flex w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors sm:px-3',
          expanded
            ? 'border-[#00C9B1]/35 bg-[rgba(0,201,177,0.1)]'
            : 'hub-guidance-glow border-[#00C9B1]/28 bg-[rgba(0,201,177,0.07)] hover:border-[#00C9B1]/45 hover:bg-[rgba(0,201,177,0.11)]',
        )}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#00C9B1]/90" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/75">
          <span className="text-[#00C9B1]/90">{guidance.title}</span>
          <span className="text-white/35"> · </span>
          {guidance.phaseLabel} steps · {guidance.percentComplete}% complete
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-[#00C9B1]/70 transition-transform',
            expanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[min(52vh,340px)] overflow-hidden rounded-xl border border-[#00C9B1]/30 bg-[#0a0e0e] shadow-[0_0_24px_rgba(0,201,177,0.18),0_12px_40px_-8px_rgba(0,0,0,0.65)]"
          role="dialog"
          aria-label={`${guidance.phaseLabel} guidance`}
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
            <p className="text-[12px] font-semibold text-white/88">{guidance.headline}</p>
            <button
              type="button"
              className="rounded-md p-1 text-white/40 hover:bg-white/[0.06] hover:text-white/70"
              aria-label="Close guidance"
              onClick={() => setExpanded(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="app-scrollbar max-h-[min(48vh,300px)] overflow-y-auto overscroll-contain p-3 pb-10">
            {guidance.summary?.trim() ? (
              <p className="mb-2 text-[11px] leading-relaxed text-white/48">{guidance.summary.trim()}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ul className="space-y-1" role="list">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      selected={selectedTask?.id === task.id}
                      onSelect={() => setSelectedTaskId(task.id)}
                      togglePending={togglePendingTaskId === task.id}
                      compact
                      onToggle={
                        onToggleTask
                          ? (completed) => onToggleTask(task.id, completed)
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>

              {selectedTask ? (
                <div className="rounded-lg border border-white/[0.08] bg-[#080a0a]/80 p-3">
                  <p className="text-[12px] font-semibold text-white/90">{selectedTask.label}</p>
                  {selectedTask.supporting?.trim() ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-white/52">
                      {selectedTask.supporting.trim()}
                    </p>
                  ) : null}
                  {selectedTask.tips?.length ? (
                    <ul className="mt-2 space-y-1">
                      {selectedTask.tips.map((tip) => (
                        <li
                          key={tip}
                          className="flex gap-2 text-[11px] leading-relaxed text-white/55 before:mt-1.5 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-[#00C9B1]/70 before:content-['']"
                        >
                          {tip}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTask.ctaHref && selectedTask.ctaLabel ? (
                      onNavigate ? (
                        <Button
                          type="button"
                          className="h-7 bg-[#00C9B1] px-2.5 text-[10px] font-semibold text-[#080A0A] hover:bg-[#00C9B1]"
                          onClick={() => handleCta(selectedTask.ctaHref!)}
                        >
                          {selectedTask.ctaLabel}
                        </Button>
                      ) : (
                        <Button
                          asChild
                          className="h-7 bg-[#00C9B1] px-2.5 text-[10px] font-semibold text-[#080A0A] hover:bg-[#00C9B1]"
                        >
                          <Link href={selectedTask.ctaHref}>{selectedTask.ctaLabel}</Link>
                        </Button>
                      )
                    ) : null}
                    {selectedTask.secondaryCtaHref && selectedTask.secondaryCtaLabel ? (
                      onNavigate ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 border border-white/12 px-2.5 text-[10px]"
                          onClick={() => handleCta(selectedTask.secondaryCtaHref!)}
                        >
                          {selectedTask.secondaryCtaLabel}
                        </Button>
                      ) : (
                        <Button asChild variant="ghost" className="h-7 border border-white/12 px-2.5 text-[10px]">
                          <Link href={selectedTask.secondaryCtaHref}>
                            {selectedTask.secondaryCtaLabel}
                          </Link>
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
