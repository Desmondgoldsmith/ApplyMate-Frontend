'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '@/lib/utils';

const inputClass = (hasError: boolean) =>
  cn(
    'auth-input w-full rounded-[10px] border bg-[#111616] px-4 py-3 text-white outline-none transition',
    'placeholder:text-white/35 focus:bg-[#111616]',
    hasError
      ? 'border-[rgba(255,80,60,0.5)]'
      : 'border-[rgba(0,201,177,0.2)] focus:border-[#00C9B1] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)]',
  );

type AuthTextInputProps = {
  id?: string;
  type?: 'text' | 'email' | 'password';
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
};

export function AuthTextInput({
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
}: AuthTextInputProps) {
  const genId = useId();
  const inputId = id ?? genId;

  return (
    <div>
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClass(Boolean(error))}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

type AuthPasswordInputProps = {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
};

export function AuthPasswordInput({
  placeholder = 'Password',
  value,
  onChange,
  error,
  autoComplete = 'current-password',
}: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const genId = useId();

  return (
    <div>
      <div className="relative">
        <input
          id={genId}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(inputClass(Boolean(error)), 'pr-12')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1.5 text-[#00C9B1] transition hover:bg-white/5 hover:text-[#00C9B1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C9B1]"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
