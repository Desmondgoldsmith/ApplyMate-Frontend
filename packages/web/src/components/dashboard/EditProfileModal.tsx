'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

type EditProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  email?: string;
};

export function EditProfileModal({ open, onOpenChange, initialName, email }: EditProfileModalProps) {
  const [name, setName] = useState(initialName ?? '');
  const queryClient = useQueryClient();
  const toast = useToast();
  const syncUserFromMe = useAuthStore((s) => s.syncUserFromMe);

  useEffect(() => {
    if (open) setName(initialName ?? '');
  }, [open, initialName]);

  const save = useMutation({
    mutationFn: (payload: { name: string }) => api.users.updateMe(payload),
    onSuccess: (next) => {
      syncUserFromMe(next);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit profile"
      description="Update the name shown across ApplyMate. Email is managed by your account provider."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            toast.error('Please enter a name');
            return;
          }
          save.mutate({ name: trimmed });
        }}
      >
        <div>
          <label htmlFor="edit-profile-name" className="mb-1.5 block text-xs font-medium text-white/50">
            Name
          </label>
          <input
            id="edit-profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[#00C9B1]/20 bg-[#111616] px-4 py-3 text-sm text-white outline-none transition focus:border-[#00C9B1]"
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="edit-profile-email" className="mb-1.5 block text-xs font-medium text-white/50">
            Email
          </label>
          <input
            id="edit-profile-email"
            value={email ?? ''}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/50"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
