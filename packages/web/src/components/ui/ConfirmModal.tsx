'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

type ConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
  layerZIndex?: number;
};

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isPending = false,
  onConfirm,
  layerZIndex,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description} layerZIndex={layerZIndex}>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          disabled={isPending}
          className={
            variant === 'danger'
              ? 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
              : undefined
          }
          onClick={async () => {
            try {
              await Promise.resolve(onConfirm());
              onOpenChange(false);
            } catch {
              /* Caller shows toast; keep modal open */
            }
          }}
        >
          {isPending ? 'Please wait…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
