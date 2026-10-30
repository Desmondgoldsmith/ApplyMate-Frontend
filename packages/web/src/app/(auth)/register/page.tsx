'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { z } from 'zod';

import { AuthFormCard } from '@/components/auth/AuthFormCard';
import { BrandMark } from '@/components/brand/BrandMark';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { useGoogleOAuthErrorToast } from '@/components/auth/useGoogleOAuthErrorToast';
import { useSessionReuseToast } from '@/components/auth/useSessionReuseToast';
import { AuthPasswordInput, AuthTextInput } from '@/components/auth/AuthInputs';
import { AppShellBackdrop } from '@/components/layout/AppShellBackdrop';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { captureEvent } from '@/lib/analytics';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

/** Must match `RegisterDto` on the API (min 8). */
const PASSWORD_MIN = 8;

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`),
});

type FormValues = z.infer<typeof schema>;

function RegisterPageContent() {
  const router = useRouter();
  const toast = useToast();
  useGoogleOAuthErrorToast();
  useSessionReuseToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState<FormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormValues, string>>
  >({});
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
      const login = await api.auth.login({
        email: form.email,
        password: form.password,
      });
      setAuth(login.user, login.accessToken, login.refreshToken);
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
          <BrandMark className="mb-6" />
          <h1 className="text-[28px] font-extrabold text-white">
            Create your account
          </h1>
          <p className="mb-6 text-sm text-white/50">
            Free to start. Get your CV score in about two minutes.
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
          >
            <AuthTextInput
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(v) => {
                setForm((s) => ({ ...s, email: v }));
                if (errors.email)
                  setErrors((e) => ({ ...e, email: undefined }));
              }}
              error={errors.email}
              autoComplete="email"
            />
            <AuthPasswordInput
              value={form.password}
              onChange={(v) => {
                setForm((s) => ({ ...s, password: v }));
                if (errors.password)
                  setErrors((e) => ({ ...e, password: undefined }));
              }}
              error={errors.password}
              autoComplete="new-password"
            />
            {!errors.password ? (
              <p
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  form.password.length >= PASSWORD_MIN
                    ? 'text-[#7EE8D8]'
                    : 'text-white/40',
                )}
              >
                {form.password.length >= PASSWORD_MIN ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                ) : null}
                At least {PASSWORD_MIN} characters
              </p>
            ) : null}
            <Button fullWidth disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Register'}
            </Button>
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

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-white/50">
          Loading…
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
