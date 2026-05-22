import { ImageResponse } from 'next/og';

import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export const runtime = 'edge';
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(145deg, #050808 0%, #0a1214 45%, #0d1f1e 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#00C9B1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
              color: '#050808',
            }}
          >
            AM
          </div>
          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>{SITE_NAME}</span>
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2, maxWidth: 900 }}>
          Apply smarter.
          <br />
          <span style={{ color: '#00C9B1' }}>Get hired faster.</span>
        </div>
        <p style={{ marginTop: 36, fontSize: 26, color: 'rgba(255,255,255,0.72)', maxWidth: 820, lineHeight: 1.4 }}>
          Score your CV against any role, tailor applications, and track your job search — powered by AI.
        </p>
      </div>
    ),
    { ...size },
  );
}
