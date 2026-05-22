import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 primarily uses `@theme` in `src/app/globals.css`.
 * This file keeps named tokens aligned with tooling that expects a config file
 * and documents the brand palette in one place.
 */
export default {
  theme: {
    extend: {
      colors: {
        primary: '#e76607',
        'primary-foreground': '#ffffff',
        accent: '#36a1ea',
        'accent-foreground': '#ffffff',
      },
    },
  },
} satisfies Config;
