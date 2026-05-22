'use client';

import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { JobHubBadges } from './JobHubBadges';
import { JobHubRowMenu } from './JobHubRowMenu';

import { HUB_STAGE_LABELS, HUB_STAGES, type HubStage, type TrackedJob } from './jobHubMerge';

function KanbanCard({
  job,
  onOpen,
  onPrefetch,
  archivingJobKey,
  onRequestArchiveJob,
  onRequestPipelineRemoveJob,
  onRequestUnbookmarkJob,
}: {
  job: TrackedJob;
  onOpen: (job: TrackedJob) => void;
  onPrefetch?: (job: TrackedJob) => void;
  archivingJobKey?: string | null;
  onRequestArchiveJob: (job: TrackedJob) => void;
  onRequestPipelineRemoveJob: (job: TrackedJob) => void;
  onRequestUnbookmarkJob: (job: TrackedJob) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.key,
    data: { job },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex w-full gap-1 rounded-xl border border-white/[0.08] bg-[#0f1414] p-2 text-left shadow-sm transition-shadow hover:border-[#00C9B1]/35 hover:shadow-md',
        isDragging && 'z-20 opacity-90 ring-2 ring-[#00C9B1]/40',
      )}
    >
      <button
        type="button"
        className="mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-white/35 hover:bg-[#00C9B1]/20 hover:text-[#00C9B1] active:cursor-grabbing"
        aria-label="Drag to change stage"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 py-1 pr-1 text-left"
        onClick={() => onOpen(job)}
        onMouseEnter={() => onPrefetch?.(job)}
        onFocus={() => onPrefetch?.(job)}
      >
        <p className="text-sm font-semibold leading-snug text-white">{job.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-white/45">{job.company}</p>
        <JobHubBadges job={job} className="mt-2" />
        {job.matchScore != null ? (
          <p className="mt-2 text-[11px] font-medium tabular-nums text-[#00C9B1]">
            {Math.round(job.matchScore)}% match
          </p>
        ) : null}
      </button>
      <JobHubRowMenu
        job={job}
        disabled={archivingJobKey === job.key}
        onRequestArchive={onRequestArchiveJob}
        onRequestRemoveFromPipeline={onRequestPipelineRemoveJob}
        onRequestUnbookmark={onRequestUnbookmarkJob}
      />
    </div>
  );
}

function KanbanColumn({
  stage,
  jobs,
  onOpen,
  onPrefetch,
  archivingJobKey,
  onRequestArchiveJob,
  onRequestPipelineRemoveJob,
  onRequestUnbookmarkJob,
}: {
  stage: HubStage;
  jobs: TrackedJob[];
  onOpen: (job: TrackedJob) => void;
  onPrefetch?: (job: TrackedJob) => void;
  archivingJobKey?: string | null;
  onRequestArchiveJob: (job: TrackedJob) => void;
  onRequestPipelineRemoveJob: (job: TrackedJob) => void;
  onRequestUnbookmarkJob: (job: TrackedJob) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[240px] w-[min(200px,calc(100vw-5.5rem))] shrink-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2 sm:min-h-[280px] sm:w-[200px] lg:w-[220px]',
        isOver && 'border-[#1a9e75]/45 bg-[#1a9e75]/[0.06]',
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-white/50">
          {HUB_STAGE_LABELS[stage]}
        </h3>
        <span className="text-[11px] tabular-nums text-white/35">{jobs.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto app-scrollbar">
        {jobs.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-2 py-8 text-center text-xs text-white/30">
            No jobs
          </p>
        ) : (
          jobs.map((job) => (
            <KanbanCard
              key={job.key}
              job={job}
              onOpen={onOpen}
              onPrefetch={onPrefetch}
              archivingJobKey={archivingJobKey}
              onRequestArchiveJob={onRequestArchiveJob}
              onRequestPipelineRemoveJob={onRequestPipelineRemoveJob}
              onRequestUnbookmarkJob={onRequestUnbookmarkJob}
            />
          ))
        )}
      </div>
    </div>
  );
}

type Props = {
  jobs: TrackedJob[];
  onStageChange: (job: TrackedJob, stage: HubStage) => void;
  onOpenJob: (job: TrackedJob) => void;
  onPrefetchJob?: (job: TrackedJob) => void;
  archivingJobKey?: string | null;
  onRequestArchiveJob: (job: TrackedJob) => void;
  onRequestPipelineRemoveJob: (job: TrackedJob) => void;
  onRequestUnbookmarkJob: (job: TrackedJob) => void;
};

export function JobHubKanban({
  jobs,
  onStageChange,
  onOpenJob,
  onPrefetchJob,
  archivingJobKey = null,
  onRequestArchiveJob,
  onRequestPipelineRemoveJob,
  onRequestUnbookmarkJob,
}: Props) {
  const [active, setActive] = useState<TrackedJob | null>(null);

  const byStage = useMemo(() => {
    const m = new Map<HubStage, TrackedJob[]>();
    for (const s of HUB_STAGES) m.set(s, []);
    for (const j of jobs) {
      const list = m.get(j.stage) ?? [];
      list.push(j);
      m.set(j.stage, list);
    }
    return m;
  }, [jobs]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const j = jobs.find((x) => x.key === e.active.id);
    setActive(j ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active, over } = e;
    if (!over) return;
    const job = jobs.find((x) => x.key === active.id);
    if (!job) return;
    const overId = String(over.id) as HubStage;
    if (!HUB_STAGES.includes(overId) || overId === job.stage) return;
    onStageChange(job, overId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 app-scrollbar [-webkit-overflow-scrolling:touch]">
        {HUB_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            jobs={byStage.get(stage) ?? []}
            onOpen={onOpenJob}
            onPrefetch={onPrefetchJob}
            archivingJobKey={archivingJobKey}
            onRequestArchiveJob={onRequestArchiveJob}
            onRequestPipelineRemoveJob={onRequestPipelineRemoveJob}
            onRequestUnbookmarkJob={onRequestUnbookmarkJob}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[min(200px,calc(100vw-5.5rem))] rounded-xl border border-[#00C9B1]/40 bg-[#0f1414] p-3 shadow-xl sm:w-[200px]">
            <p className="text-sm font-semibold text-white">{active.title}</p>
            <p className="mt-1 text-xs text-white/45">{active.company}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
