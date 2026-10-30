'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { z } from 'zod';

import { AuthDivider } from '@/components/auth/AuthDivider';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { useGoogleOAuthErrorToast } from '@/components/auth/useGoogleOAuthErrorToast';
import { useSessionReuseToast } from '@/components/auth/useSessionReuseToast';
import { AuthPasswordInput, AuthTextInput } from '@/components/auth/AuthInputs';
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

function PasswordLengthHint({ length }: { length: number }) {
  const met = length >= PASSWORD_MIN;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 transition-colors',
        met ? 'font-medium text-success-text' : 'text-text-tertiary',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border transition-colors',
          met
            ? 'border-success-text bg-success-subtle'
            : 'border-border-strong',
        )}
        aria-hidden
      >
        {met ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
      </span>
      At least {PASSWORD_MIN} characters
    </span>
  );
}

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

  const updateField = (key: keyof FormValues, value: string) => {
    setForm((s) => ({ ...s, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

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
    <AuthLayout
      title="Create your account"
      subtitle="Free to start. Get your CV score in about two minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <GoogleSignInButton mode="register" disabled={isSubmitting} />
      <AuthDivider />
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <AuthTextInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(v) => updateField('email', v)}
          error={errors.email}
          autoComplete="email"
        />
        <AuthPasswordInput
          value={form.password}
          onChange={(v) => updateField('password', v)}
          error={errors.password}
          hint={<PasswordLengthHint length={form.password.length} />}
          autoComplete="new-password"
        />
        <Button variant="accent" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-page text-sm text-text-secondary">
          Loading…
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
