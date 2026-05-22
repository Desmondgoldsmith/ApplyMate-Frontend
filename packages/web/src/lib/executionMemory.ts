import { api } from '@/lib/api';

export type ExecutionCheckpointInput = {
  workflowEntityId: string;
  workflowEntityType: string;
  executionType: string;
  component: string;
  stepKey: string;
  percentComplete?: number;
  estimatedRemainingMinutes?: number | null;
  resumeConfidence?: number | null;
  hydrationConsistencyKey?: string | null;
  snapshot?: Record<string, unknown> | null;
};

export function canonicalWorkflowEntityId(
  kind: 'job' | 'analysis' | 'application' | 'cv' | 'followup' | 'interview',
  id: string,
): string {
  return `${kind}:${id.trim()}`;
}

export async function recordExecutionCheckpoint(input: ExecutionCheckpointInput): Promise<void> {
  const workflowEntityId = input.workflowEntityId.trim();
  const workflowEntityType = input.workflowEntityType.trim();
  const executionType = input.executionType.trim();
  const component = input.component.trim();
  const stepKey = input.stepKey.trim();
  if (!workflowEntityId || !workflowEntityType || !executionType || !component || !stepKey) return;
  const pct =
    typeof input.percentComplete === 'number' && Number.isFinite(input.percentComplete)
      ? Math.max(0, Math.min(100, Math.round(input.percentComplete)))
      : undefined;
  await api.execution.checkpoint({
    workflowEntityId,
    workflowEntityType,
    executionType,
    component,
    stepKey,
    ...(pct != null ? { percentComplete: pct } : {}),
    ...(input.estimatedRemainingMinutes != null ? { estimatedRemainingMinutes: input.estimatedRemainingMinutes } : {}),
    ...(input.resumeConfidence != null ? { resumeConfidence: input.resumeConfidence } : {}),
    ...(input.hydrationConsistencyKey != null ? { hydrationConsistencyKey: input.hydrationConsistencyKey } : {}),
    ...(input.snapshot != null ? { snapshot: input.snapshot } : {}),
  });
}

export async function markExecutionComplete(args: { workflowEntityId: string; executionType: string }): Promise<void> {
  const workflowEntityId = args.workflowEntityId.trim();
  const executionType = args.executionType.trim();
  if (!workflowEntityId || !executionType) return;
  await api.execution.complete({ workflowEntityId, executionType });
}

