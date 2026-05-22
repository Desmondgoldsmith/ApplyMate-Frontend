import type { ReactNode } from 'react';

type ConicGlowBorderProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  radiusOuter?: number;
  radiusInner?: number;
};

export function ConicGlowBorder({
  children,
  className = '',
  innerClassName = '',
  radiusOuter = 24,
  radiusInner = 23,
}: ConicGlowBorderProps) {
  return (
    <div
      className={`relative p-px ${className}`}
      style={{
        borderRadius: radiusOuter,
        background:
          'conic-gradient(from 120deg, #00C9B1, #007A7B, rgba(0,201,177,0.12), #00C9B1, #00C9B1)',
        boxShadow: '0 0 60px rgba(0, 174, 175, 0.18)',
      }}
    >
      <div
        className={`h-full w-full bg-[#080A0A] ${innerClassName}`}
        style={{ borderRadius: radiusInner }}
      >
        {children}
      </div>
    </div>
  );
}
