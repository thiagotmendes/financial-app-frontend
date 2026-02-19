import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        storm: '#1f2937',
        mint: '#34d399',
        sky: '#38bdf8',
        peach: '#fb923c',
      },
      boxShadow: {
        glow: '0 20px 80px rgba(56, 189, 248, 0.24)',
      },
      fontFamily: {
        title: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
