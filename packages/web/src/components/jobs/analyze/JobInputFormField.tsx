'use client';

/** Single labeled field for the job analyze input column. */
export function JobInputFormField({
  label,
  id,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const inputId =
    id ?? `analyze-field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="min-w-0">
      <label
        className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-white/35"
        htmlFor={inputId}
      >
        {label}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-xl border border-white/[0.1] bg-[#0F1512] px-3 text-[13px] text-[#F0F4F2] outline-none transition-colors duration-150 placeholder:text-white/30 focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.08)]"
      />
    </div>
  );
}
