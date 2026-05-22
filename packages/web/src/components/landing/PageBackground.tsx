'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const NOISE_SVG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")";

export function PageBackground() {
  const [isMd, setIsMd] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsMd(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const orbOpacity = isMd ? 1 : 0.03;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#060A0A]" aria-hidden />

      {isMd ? (
        <>
          <div
            className="pointer-events-none fixed top-0 z-0"
            style={{
              left: '15%',
              width: 1,
              height: '70vh',
              background:
                'linear-gradient(180deg, rgba(0,201,177,0.4), transparent)',
              filter: 'blur(40px)',
              transform: 'rotate(15deg)',
              transformOrigin: 'top center',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed top-0 left-1/2 z-0 -translate-x-1/2"
            style={{
              width: 2,
              height: '60vh',
              background:
                'linear-gradient(180deg, rgba(0,201,177,0.25), transparent)',
              filter: 'blur(60px)',
              transform: 'rotate(0deg)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed top-0 z-0"
            style={{
              right: '20%',
              width: 1,
              height: '65vh',
              background:
                'linear-gradient(180deg, rgba(0,201,177,0.3), transparent)',
              filter: 'blur(40px)',
              transform: 'rotate(-12deg)',
              transformOrigin: 'top center',
            }}
            aria-hidden
          />
        </>
      ) : null}

      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,201,177,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,201,177,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
        aria-hidden
      />

      <motion.div
        className="pointer-events-none fixed z-0 rounded-full"
        style={{
          top: -200,
          left: -200,
          width: 600,
          height: 600,
          background:
            'radial-gradient(circle, rgba(0,201,177,0.06) 0%, transparent 70%)',
          opacity: orbOpacity,
        }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none fixed z-0 rounded-full"
        style={{
          bottom: -300,
          right: -200,
          width: 700,
          height: 700,
          background:
            'radial-gradient(circle, rgba(0,130,130,0.05) 0%, transparent 70%)',
          opacity: orbOpacity,
        }}
        animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: NOISE_SVG,
          opacity: 0.025,
        }}
        aria-hidden
      />
    </>
  );
}
