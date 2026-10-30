'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const inputClass = (hasError: boolean) =>
  cn(
    'auth-input h-12 w-full rounded-xl border bg-bg-sunken px-4 text-[15px] text-text-primary outline-none transition-[border-color,box-shadow,background-color] duration-150',
    'placeholder:text-text-tertiary focus:bg-bg-surface',
    hasError
      ? 'border-danger-text focus:shadow-[0_0_0_3px_var(--ck-danger-subtle)]'
      : 'border-border-strong focus:border-border-focus focus:shadow-[0_0_0_3px_var(--ck-accent-subtle)]',
  );

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-semibold text-text-primary"
    >
      {children}
    </label>
  );
}

function FieldMessage({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string;
  hint?: ReactNode;
}) {
  if (error) {
    return (
      <p id={id} className="mt-1.5 text-[13px] font-medium text-danger-text">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <div id={id} className="mt-1.5 text-[13px] text-text-tertiary">
        {hint}
      </div>
    );
  }
  return null;
}

type AuthTextInputProps = {
  id?: string;
  label: string;
  type?: 'text' | 'email';
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  autoComplete?: string;
};

export function AuthTextInput({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  hint,
  autoComplete,
}: AuthTextInputProps) {
  const genId = useId();
  const inputId = id ?? genId;
  const messageId = `${inputId}-message`;

  return (
    <div>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClass(Boolean(error))}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

type AuthPasswordInputProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  autoComplete?: string;
};

export function AuthPasswordInput({
  label = 'Password',
  placeholder,
  value,
  onChange,
  error,
  hint,
  autoComplete = 'current-password',
}: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const messageId = `${inputId}-message`;

  return (
    <div>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(inputClass(Boolean(error)), 'pr-12')}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          ) : (
            <Eye className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}
