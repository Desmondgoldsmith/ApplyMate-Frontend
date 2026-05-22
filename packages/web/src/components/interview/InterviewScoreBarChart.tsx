'use client';

import { memo, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { InterviewChartPoint } from '@/lib/interviewChartData';
import { cn } from '@/lib/utils';

type TooltipPayload = {
  dateLabel: string;
  score: number;
  focusAreas?: string[];
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="min-w-[180px] max-w-[240px] rounded-xl border border-[#00C9B1]/35 bg-[#0a1214]/95 px-3.5 py-3 text-left shadow-xl backdrop-blur-md">
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">{row.dateLabel}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-[#00C9B1]">{row.score}%</p>
      {row.focusAreas && row.focusAreas.length > 0 ? (
        <div className="mt-2.5 border-t border-white/10 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
            Focus next
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-white/75">
            {row.focusAreas.slice(0, 3).map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-white/50">Keep practicing to sharpen this score.</p>
      )}
    </div>
  );
}

export const InterviewScoreBarChart = memo(function InterviewScoreBarChart({
  points,
  focusAreas,
  className,
  height = 200,
  barLabel = 'Score',
}: {
  points: InterviewChartPoint[];
  /** Shown in hover tooltip as improvement hints. */
  focusAreas?: string[];
  className?: string;
  height?: number;
  barLabel?: string;
}) {
  const chartData = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        focusAreas,
      })),
    [focusAreas, points],
  );

  const yMax = useMemo(() => {
    const top = Math.max(...points.map((p) => p.score), 0);
    return Math.min(100, Math.max(40, Math.ceil((top + 8) / 5) * 5));
  }, [points]);

  if (points.length < 2) {
    return (
      <p className={cn('text-xs text-white/45', className)}>
        Complete another session to see your trend chart.
      </p>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            label={{
              value: barLabel,
              angle: -90,
              position: 'insideLeft',
              fill: 'rgba(255,255,255,0.35)',
              fontSize: 10,
              dx: 8,
            }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'rgba(0,201,177,0.08)' }}
            animationDuration={150}
          />
          <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={36}>
            {chartData.map((entry) => (
              <Cell
                key={entry.sessionId}
                fill={entry.isCurrent ? '#00C9B1' : 'rgba(0,201,177,0.55)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
