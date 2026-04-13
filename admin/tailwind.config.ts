import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans',       '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        heading: ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        background:  'rgb(var(--background))',
        foreground:  'rgb(var(--foreground))',
        card: {
          DEFAULT:    '#FFFFFF',
          foreground: 'rgb(var(--card-foreground))',
        },
        muted: {
          DEFAULT:    '#F1F5F9',
          foreground: '#64748B',
        },
        border:  '#E2E8F0',
        input:   '#FFFFFF',
        ring:    '#22c55e',
        primary: {
          DEFAULT:    '#22c55e',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT:    '#F1F5F9',
          foreground: '#0F172A',
        },
        destructive: {
          DEFAULT:    '#EF4444',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#22c55e',
          dim:     '#16a34a',
        },
        slate: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      borderRadius: {
        sm:   '6px',
        md:   '8px',
        lg:   '10px',
        xl:   '12px',
        '2xl':'16px',
        '3xl':'24px',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md:    '0 4px 12px rgba(0,0,0,0.08)',
        lg:    '0 8px 24px rgba(0,0,0,0.12)',
        glow:  '0 0 24px rgba(34,197,94,0.2)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
