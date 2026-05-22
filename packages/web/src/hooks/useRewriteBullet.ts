'use client';

import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useRewriteBullet() {
  return useMutation({
    mutationFn: api.cv.rewriteBullet,
  });
}
