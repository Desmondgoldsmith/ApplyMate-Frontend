'use client';

import { Modal } from '@/components/ui/Modal';
import { CvParseImportSummaryPanel } from '@/components/cv/CvParseImportSummaryPanel';
import type { CvParseImportSummary } from '@/lib/cvParseImportSummary';

type CvParseImportSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importSummary: CvParseImportSummary | null;
  onContinue: () => void;
  continueLabel?: string;
  title?: string;
};

export function CvParseImportSummaryModal({
  open,
  onOpenChange,
  importSummary,
  onContinue,
  continueLabel = 'Open CV editor',
  title = 'CV imported',
}: CvParseImportSummaryModalProps) {
  if (!importSummary) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Review what we extracted, then open the editor."
      className="max-w-lg border border-accent-border shadow-[0_0_40px_rgba(23,178,106,0.1)]"
      scrollBody
    >
      <CvParseImportSummaryPanel
        embedded
        importSummary={importSummary}
        onContinue={onContinue}
        continueLabel={continueLabel}
      />
    </Modal>
  );
}
