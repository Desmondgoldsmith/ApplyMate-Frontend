'use client';

import { motion } from 'framer-motion';

import { CVDocumentPreview } from '@/components/cv/CVDocumentPreview';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import {
  type CVBuilderData,
  type CvTemplateId,
  CV_TEMPLATE_IDS,
} from '@/lib/cvBuilder';

const TEMPLATE_LABELS: Record<CvTemplateId, string> = {
  classic: 'Classic',
  modern: 'Modern',
  creative: 'Creative',
  professional: 'Professional',
  'europass-classic': 'Europass Classic',
  'europass-modern': 'Europass Modern',
  french: 'French CV',
  german: 'German Lebenslauf',
  uk: 'UK CV',
};

const TEAL = '#00C9B1';

export type TemplatePickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CVBuilderData;
  selected: CvTemplateId;
  onSelect: (t: CvTemplateId) => void;
  modalTitle?: string;
  modalDescription?: string;
  /** When set, only these templates appear (order preserved). */
  templateIds?: readonly CvTemplateId[];
  showFooterHint?: boolean;
};

export function TemplatePickerModal({
  open,
  onOpenChange,
  data,
  selected,
  onSelect,
  modalTitle = 'Templates',
  modalDescription = 'Pick a layout. Your content stays the same.',
  templateIds,
  showFooterHint = true,
}: TemplatePickerModalProps) {
  const ids =
    templateIds && templateIds.length > 0
      ? templateIds.filter((id): id is CvTemplateId => CV_TEMPLATE_IDS.includes(id))
      : [...CV_TEMPLATE_IDS];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={modalDescription}
      scrollBody
      className="max-w-4xl"
    >
      {open ? (
        <div className="pr-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ids.map((tid) => (
              <motion.button
                key={tid}
                type="button"
                layout
                onClick={() => {
                  onSelect(tid);
                  onOpenChange(false);
                }}
                className={cn(
                  'flex flex-col overflow-hidden rounded-xl border bg-[#080B0B] text-left transition',
                  selected === tid
                    ? 'border-[#00C9B1] ring-1 ring-[#00C9B1]/40'
                    : 'border-white/[0.08] hover:border-white/20',
                )}
              >
                <div
                  className="pointer-events-none relative mx-auto mt-2 overflow-hidden rounded border border-white/10 bg-white"
                  style={{ width: 120, height: 170 }}
                >
                  <div
                    className="origin-top-left"
                    style={{
                      width: 794,
                      height: 1123,
                      transform: 'scale(0.15)',
                      transformOrigin: 'top left',
                    }}
                  >
                    <CVDocumentPreview data={data} template={tid} />
                  </div>
                </div>
                <span className="border-t border-white/[0.06] px-2 py-2 text-center text-xs font-medium capitalize text-white/80">
                  {TEMPLATE_LABELS[tid]}
                </span>
              </motion.button>
            ))}
          </div>
          {showFooterHint ? (
            <p className="mt-3 text-center text-[11px] text-white/35">
              Selected template uses a teal border ({TEAL}).
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
