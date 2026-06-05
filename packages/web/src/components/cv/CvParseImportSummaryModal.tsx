'use client';

import { Modal } from '@/components/ui/Modal';
import { CvParseImportSummaryPanel } from '@/components/cv/CvParseImportSummaryPanel';
import type { CvParseImportSummary } from '@/lib/cvParseImportSummary';

type CvParseImportSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importSummary: CvParseImportSummary | null;
  profileId: string | null;
  onReviewInBuilder: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  title?: string;
};

export function CvParseImportSummaryModal({
  open,
  onOpenChange,
  importSummary,
  profileId,
  onReviewInBuilder,
  onContinue,
  continueLabel = 'Close',
  title = 'CV imported',
}: CvParseImportSummaryModalProps) {
  if (!importSummary) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className="max-w-lg"
      scrollBody
    >
      <CvParseImportSummaryPanel
        importSummary={importSummary}
        profileId={profileId}
        onReviewInBuilder={onReviewInBuilder}
        onContinue={
          onContinue ??
          (() => {
            onOpenChange(false);
          })
        }
        continueLabel={continueLabel}
      />
    </Modal>
  );
}
