import { api } from '@/lib/api';

export async function login(data: { email: string; password: string }) {
  return api.auth.login(data);
}
