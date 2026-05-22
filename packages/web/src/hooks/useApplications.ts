'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: () => api.applications.getAll(),
  });
}
