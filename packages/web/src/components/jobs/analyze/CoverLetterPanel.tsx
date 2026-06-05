'use client';

import { motion } from 'framer-motion';
import { Copy, FileDown, Pencil, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/Button';

export type CoverLetterPanelProps = {
  visible: boolean;
  coverLetterDisplay: string | null | undefined;
  coverLetterEditing: boolean;
  coverLetterDraft: string;
  coverLetterAiBaseline: string | null;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdits: (text: string) => void | Promise<void>;
  onRevertToAi: () => void;
  onCopy: () => void;
  onDownloadPdf: () => void;
};

/** Cover letter preview, edit, copy, and PDF export. */
export function CoverLetterPanel({
  visible,
  coverLetterDisplay,
  coverLetterEditing,
  coverLetterDraft,
  coverLetterAiBaseline,
  onStartEdit,
  onDraftChange,
  onCancelEdit,
  onSaveEdits,
  onRevertToAi,
  onCopy,
  onDownloadPdf,
}: CoverLetterPanelProps) {
  if (!visible || !coverLetterDisplay?.trim()) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0F1512]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
        <div>
          <p className="text-[14px] font-semibold text-[#F0F4F2]">
            Cover letter
          </p>
          <p className="mt-0.5 text-[12px] text-white/35">
            Copy, download, or edit before applying
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {!coverLetterEditing ? (
            <button
              type="button"
              onClick={onStartEdit}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-[#141C18] text-white/60 transition-colors hover:border-white/[0.1] hover:bg-[#182019] hover:text-white"
              aria-label="Edit cover letter"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCopy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-[#141C18] text-white/60 transition-colors hover:border-white/[0.1] hover:bg-[#182019] hover:text-white"
            aria-label="Copy cover letter"
          >
            <Copy className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-[#141C18] text-white/60 transition-colors hover:border-white/[0.1] hover:bg-[#182019] hover:text-white"
            aria-label="Download PDF"
          >
            <FileDown className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto px-5 py-5 app-scrollbar">
        {coverLetterEditing ? (
          <div className="space-y-3">
            <textarea
              value={coverLetterDraft}
              onChange={(e) => onDraftChange(e.target.value)}
              className="min-h-[220px] w-full resize-y rounded-xl border border-[#00C9B1]/30 bg-[#0a0e0e] px-4 py-3 text-[13px] leading-[1.75] text-white/85 outline-none focus:border-[#00C9B1]/55 focus:ring-2 focus:ring-[#00C9B1]/15"
              aria-label="Edit cover letter"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-9 px-4 text-[12px]"
                onClick={() => {
                  void onSaveEdits(coverLetterDraft.trim());
                }}
              >
                Save edits
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 gap-1.5 border border-white/12 px-3 text-[12px] text-white/70"
                onClick={onRevertToAi}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Revert to AI
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3 text-[12px] text-white/50"
                onClick={onCancelEdit}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-white/75">
            {coverLetterDisplay}
          </p>
        )}
      </div>
    </motion.div>
  );
}
