'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { AuthPasswordInput, AuthTextInput } from '@/components/auth/AuthInputs';
import { AppShellBackdrop } from '@/components/layout/AppShellBackdrop';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { captureEvent } from '@/lib/analytics';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState<FormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    captureEvent('auth_register_started');
    try {
      await api.auth.register({ email: form.email, password: form.password });
      const login = await api.auth.login({ email: form.email, password: form.password });
      setAuth(login.user, login.accessToken);
      captureEvent('auth_register_completed');
      toast.success('Account created');
      router.push('/onboarding');
    } catch (err) {
      captureEvent('auth_register_failed', {
        message: getApiErrorMessage(err) || 'Registration failed',
      });
      toast.error(getApiErrorMessage(err) || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <AppShellBackdrop />
      <div className="relative z-10 w-full max-w-[400px]">
        <AuthFormCard>
          <div className="mb-6 flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-[#00C9B1]" />
            <span className="font-semibold text-white">ApplyAI</span>
          </div>
          <h1 className="text-[28px] font-extrabold text-white">Create your account</h1>
          <p className="mb-6 text-sm text-white/50">Sign up to start your dashboard</p>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void onSubmit(); }}>
            <AuthTextInput
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((s) => ({ ...s, email: v }))}
              error={errors.email}
              autoComplete="email"
            />
            <AuthPasswordInput
              value={form.password}
              onChange={(v) => setForm((s) => ({ ...s, password: v }))}
              error={errors.password}
              autoComplete="new-password"
            />
            <Button fullWidth disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Register'}</Button>
          </form>
          <div className="my-4 text-center text-xs text-white/40">or</div>
          <GoogleSignInButton mode="register" disabled={isSubmitting} />
          <p className="mt-5 text-sm text-white/55">
            Already have an account?{' '}
            <Link href="/login" className="text-[#9be8e8] hover:underline">
              Sign in →
            </Link>
          </p>
        </AuthFormCard>
      </div>
    </div>
  );
}

