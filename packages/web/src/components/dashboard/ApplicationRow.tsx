import { Badge } from '@/components/ui/Badge';

type ApplicationRowProps = {
  company: string;
  title: string;
  matchScore?: number;
  date?: string;
};

export function ApplicationRow({
  company,
  title,
  matchScore = 0,
  date,
}: ApplicationRowProps) {
  const badgeVariant =
    matchScore > 70 ? 'teal' : matchScore >= 50 ? 'amber' : 'red';

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold text-white">{company}</p>
        <p className="text-xs text-white/55">{title}</p>
      </div>
      <Badge variant={badgeVariant}>{matchScore}%</Badge>
      <span className="text-xs text-white/45">
        {date ? new Date(date).toLocaleDateString() : '--'}
      </span>
    </div>
  );
}

