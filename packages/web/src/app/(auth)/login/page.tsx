'use client';

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
import { getLoginErrorMessage } from '@/lib/auth-login-message';
import { handoffExtensionTokenIfRequested } from '@/lib/extensionAuthHandoff';
import { SITE_NAME } from '@/lib/site';
import { useAuthStore } from '@/store/useAuthStore';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

function LoginPageContent() {
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
    captureEvent('auth_login_started');
    try {
      const result = await api.auth.login(form);
      setAuth(result.user, result.accessToken, result.refreshToken);
      await handoffExtensionTokenIfRequested(result.accessToken);
      captureEvent('auth_login_completed');
      toast.success('Signed in successfully');
      let onboardingDone = result.user.onboardingCompleted === true;
      try {
        const status = await api.onboarding.getStatus();
        onboardingDone = status.completed === true;
      } catch {
        /* use user flag */
      }
      router.push(onboardingDone ? '/dashboard' : '/onboarding');
    } catch (err) {
      const message = getLoginErrorMessage(err);
      captureEvent('auth_login_failed', { message });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to {SITE_NAME}?{' '}
          <Link
            href="/register"
            className="font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <GoogleSignInButton mode="login" disabled={isSubmitting} />
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
          autoComplete="current-password"
        />
        <Button variant="accent" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-page text-sm text-text-secondary">
          Loading…
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
