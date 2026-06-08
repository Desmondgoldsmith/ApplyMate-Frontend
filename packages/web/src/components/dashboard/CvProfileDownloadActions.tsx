'use client';

import { FileDown, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useExportCV } from '@/hooks/useExportCV';
import { getApiErrorMessage } from '@/lib/axios';
import { useToast } from '@/components/ui/Toast';

export type CvProfileDownloadActionsProps = {
  cvProfileId: string;
  jobAnalysisId?: string | null;
  template?: string | null;
  className?: string;
  compact?: boolean;
};

/** Export base CV (no tailoring required) via GET /cv/profiles/:id/export/… */
export function CvProfileDownloadActions({
  cvProfileId,
  jobAnalysisId,
  template,
  className,
  compact = false,
}: CvProfileDownloadActionsProps) {
  const exportCv = useExportCV();
  const toast = useToast();
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);
  const profileId = cvProfileId.trim();
  const resolvedTemplate = template?.trim() || 'modern';

  const handleExport = useCallback(
    async (format: 'pdf' | 'docx') => {
      if (!profileId) return;
      setExportingFormat(format);
      try {
        await exportCv.mutateAsync({
          format,
          template: resolvedTemplate,
          cvProfileId: profileId,
          jobAnalysisId: jobAnalysisId?.trim() || undefined,
        });
        toast.success(`CV downloaded as ${format.toUpperCase()}`);
      } catch (error) {
        toast.error(getApiErrorMessage(error) || 'Could not download CV');
      } finally {
        setExportingFormat(null);
      }
    },
    [exportCv, jobAnalysisId, profileId, resolvedTemplate, toast],
  );

  if (!profileId) return null;

  return (
    <div className={className}>
      {!compact ? (
        <p className="mb-2 text-[11px] leading-relaxed text-white/45">
          Download your saved CV for this role — tailoring is optional.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={compact ? 'ghost' : 'primary'}
          className={
            compact
              ? 'gap-1.5 border border-white/12 text-xs'
              : 'gap-1.5 text-xs'
          }
          disabled={Boolean(exportingFormat)}
          onClick={() => void handleExport('pdf')}
        >
          {exportingFormat === 'pdf' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          PDF
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="gap-1.5 border border-white/12 text-xs"
          disabled={Boolean(exportingFormat)}
          onClick={() => void handleExport('docx')}
        >
          {exportingFormat === 'docx' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          DOCX
        </Button>
      </div>
    </div>
  );
}
