import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** iOS home-screen icon (iOS ignores SVG touch icons). Mirrors public/brand/careerkite-app-icon.svg. */
const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 64 64"><defs><linearGradient id="l" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#d6ff5e"/><stop offset="1" stop-color="#9be22e"/></linearGradient><linearGradient id="r" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#3ad68a"/><stop offset="1" stop-color="#0e9457"/></linearGradient></defs><rect width="64" height="64" fill="#141714"/><g transform="translate(7 7) scale(0.78125)"><path d="M40 16.5 A 19.5 19.5 0 1 0 45.5 47.5" fill="none" stroke="#f4f6ef" stroke-width="8.5" stroke-linecap="round"/><path d="M29 33 C 36 31, 41 28, 45.4 28.4" fill="none" stroke="#f4f6ef" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/><circle cx="28.5" cy="33" r="4.2" fill="#b9f542"/><g transform="rotate(20 51 17)"><path d="M51 1 L40.5 12 L51 30 Z" fill="url(#l)"/><path d="M51 1 L61.5 12 L51 30 Z" fill="url(#r)"/></g></g></svg>`;

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(APP_ICON_SVG).toString('base64')}`;
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={180} height={180} alt="" />,
    { ...size },
  );
}
