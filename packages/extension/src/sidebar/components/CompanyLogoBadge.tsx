import { useState } from 'react';

const PRIMARY = '#00C9B1';
const TEAL_10 = 'rgba(0,201,177,0.10)';

type Props = {
  company: string;
  logoUrl?: string | null;
  size?: number;
  shape?: 'circle' | 'rounded';
};

export function CompanyLogoBadge({
  company,
  logoUrl,
  size = 32,
  shape = 'rounded',
}: Props) {
  const [failed, setFailed] = useState(false);
  const initial = (company.trim()[0] ?? '?').toUpperCase();
  const raw = logoUrl?.trim();
  const src =
    raw && /^https?:\/\//i.test(raw) ? raw : null;
  const borderRadius = shape === 'circle' ? '50%' : 6;

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: TEAL_10,
          color: PRIMARY,
          fontSize: Math.round(size * 0.38),
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius,
        objectFit: 'contain',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        flexShrink: 0,
      }}
    />
  );
}
