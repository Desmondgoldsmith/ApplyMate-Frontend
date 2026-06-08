import type { Config } from 'tailwindcss';

export default {
  content: ['./src/sidebar/**/*.{tsx,html,ts}'],
  theme: {
    extend: {
      colors: {
        am: {
          bg: '#080B0A',
          surface: '#0F1512',
          'surface-elevated': '#141C18',
          primary: '#00C9B1',
          'primary-hover': '#00b5a0',
          'primary-subtle': 'rgba(0,201,177,0.05)',
          'primary-subtle-plus': 'rgba(0,201,177,0.10)',
          border: 'rgba(255,255,255,0.06)',
          'border-default': 'rgba(255,255,255,0.10)',
          text: '#F0F4F2',
          'text-secondary': 'rgba(240,244,242,0.60)',
          'text-muted': 'rgba(240,244,242,0.35)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        control: '8px',
      },
    },
  },
  plugins: [],
} satisfies Config;
